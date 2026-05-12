import { useState, useRef, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pipeline } from '@xenova/transformers';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function App({ session }) {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [progress, setProgress]   = useState('');
  const workerRef                 = useRef(null);
  const inputRef                  = useRef(null);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    return () => workerRef.current?.terminate();
  }, []);

  // Fetch existing documents on load
  useEffect(() => {
    if (session?.user?.id) {
      fetchDocuments();
      fetchMessages();
    }
  }, [session]);

  async function fetchMessages() {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }

  async function fetchDocuments() {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          id, 
          file_name,
          document_chunks(count)
        `)
        .eq('user_id', session.user.id);

      if (error) throw error;
      
      const formatted = data.map(d => ({
        id: d.id,
        name: d.file_name,
        chunkCount: d.document_chunks[0]?.count || 0
      }));
      
      setDocuments(formatted);
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  }

  // --- HELPER: BROWSER-SIDE RAG LOGIC (Now in Worker) ---
  function chunkText(text) {
    const CHUNK_SIZE = 300;
    const words = text.split(/\s+/).filter(Boolean);
    const result = [];
    const step = Math.floor(CHUNK_SIZE * 0.8);
    for (let i = 0; i < words.length; i += step) {
      const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
      if (chunk.trim().length > 20) result.push(chunk);
    }
    return result;
  }

  async function extractText(file) {
    if (file.name.endsWith('.pdf')) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map(item => item.str).join(' ') + '\n';
      }
      return text;
    } else {
      return await file.text();
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setParsing(true);
    setProgress('Preparing files...');

    try {
      for (const file of files) {
        // 1. Extract Text
        const text = await extractText(file);
        if (!text.trim()) continue;

        // 2. Chunk Text
        const chunks = chunkText(text);
        
        // 3. Generate Embeddings via Worker
        const processedChunks = await new Promise((resolve, reject) => {
          workerRef.current.onmessage = (e) => {
            if (e.data.type === 'progress') {
              setProgress(`Embedding: ${e.data.current}/${e.data.total}`);
            } else if (e.data.type === 'done') {
              resolve(e.data.chunks);
            } else if (e.data.type === 'status') {
              setProgress(e.data.message);
            } else if (e.data.type === 'error') {
              reject(new Error(e.data.error));
            }
          };
          workerRef.current.postMessage({ type: 'embed_chunks', chunks });
        });

        // 4. Send to server to save
        setProgress('Saving to cloud...');
        const res = await fetch(import.meta.env.VITE_API_URL.replace('/chat', '/upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ 
            userId: session.user.id, 
            fileName: file.name, 
            chunks: processedChunks 
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }

        const data = await res.json();
        setDocuments(prev => [...prev, { id: data.id, name: data.name, chunkCount: data.chunks }]);
      }
    } catch (err) {
      console.error(err);
      alert(`❌ Error processing files: ${err.message}`);
    }

    setParsing(false);
    setProgress('');
    e.target.value = '';
  }

  async function handleDelete(docId, e) {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

      if (error) throw error;
      setDocuments(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      alert(`❌ Failed to delete document: ${err.message}`);
    }
  }

  async function sendQuery() {
    const query = inputRef.current?.value.trim();
    if (!query || loading) return;
    inputRef.current.value = '';
    setLoading(true);

    const userMsg = { role: 'user', content: query };
    const history = [...messages, userMsg];
    setMessages(history);

    try {
      const queryEmbedding = await new Promise((resolve, reject) => {
        workerRef.current.onmessage = (e) => {
          if (e.data.type === 'query_done') resolve(e.data.embedding);
          else if (e.data.type === 'error') reject(new Error(e.data.error));
        };
        workerRef.current.postMessage({ type: 'embed_query', text: query });
      });

      const response = await fetch(import.meta.env.VITE_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          messages: history, 
          userId: session.user.id,
          queryEmbedding: queryEmbedding
        }),
      });

      if (!response.ok) throw new Error('Server error');

      // Setup for streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
      // Add empty assistant message that we will populate
      setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '');
            if (dataStr === '[DONE]') continue;

            try {
              const data = JSON.parse(dataStr);
              if (data.content) {
                assistantContent += data.content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, content: assistantContent }];
                });
              }
            } catch (e) { /* partial chunk */ }
          }
        }
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Error: ${err.message}` }]);
    }

    setLoading(false);
  }

  const s = {
    root: { 
      display:'flex', 
      height:'100vh', 
      fontFamily:'"Outfit", "Inter", system-ui, sans-serif', 
      background:'#05060a', 
      color:'#e8eaf0',
      overflow: 'hidden'
    },
    sidebar: { 
      width:280, 
      background: 'rgba(13, 17, 23, 0.7)',
      backdropFilter: 'blur(12px)',
      borderRight:'1px solid rgba(255, 255, 255, 0.05)', 
      padding:'24px 20px', 
      display:'flex', 
      flexDirection:'column', 
      gap:16,
      boxShadow: '10px 0 30px rgba(0,0,0,0.3)'
    },
    chat: { 
      flex:1, 
      display:'flex', 
      flexDirection:'column',
      background: 'radial-gradient(circle at top right, #0d1117, #05060a)'
    },
    toolbar: { 
      padding:'16px 24px', 
      display:'flex', 
      gap:8, 
      justifyContent:'space-between',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.03)'
    },
    messages: { 
      flex:1, 
      overflowY:'auto', 
      padding:'24px', 
      display:'flex', 
      flexDirection:'column', 
      gap:24,
      scrollBehavior: 'smooth'
    },
    inputRow: { 
      padding:'20px 24px 32px', 
      background: 'transparent'
    },
    inputWrap: { 
      display:'flex', 
      gap:12, 
      background:'rgba(255, 255, 255, 0.03)', 
      border:'1px solid rgba(255, 255, 255, 0.08)', 
      borderRadius:16, 
      padding:'12px 16px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease'
    },
  };

  return (
    <div style={s.root}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>

      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
          <img src="/logo.png" alt="Aura Logo" style={{ width:32, height:32, borderRadius:8 }} onError={(e) => e.target.style.display='none'} />
          <div style={{ fontWeight:600, fontSize:22, letterSpacing:'-0.8px', background:'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Aura</div>
        </div>
        <div style={{ fontSize:10, color:'#4b5563', marginBottom:16, fontWeight:500, letterSpacing:'0.5px' }}>RAG RESEARCH ASSISTANT</div>


        <label style={{ 
          border:'1px dashed rgba(255,255,255,0.15)', 
          borderRadius:12, 
          padding:'20px 12px', 
          textAlign:'center', 
          cursor:'pointer', 
          fontSize:13, 
          color: parsing ? '#fbbf24' : '#9ca3af', 
          transition:'all 0.2s',
          background: 'rgba(255,255,255,0.02)' 
        }}>
          <input type="file" multiple accept=".txt,.md,.pdf" onChange={handleUpload} style={{ display:'none' }} disabled={parsing} />
          {parsing ? (
            <div style={{ animation: 'pulse 1.5s infinite' }}>
              ⏳ <span style={{ fontWeight:500 }}>{progress || 'Thinking...'}</span>
              <style>{`@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`}</style>
            </div>
          ) : (
            <>
              <div style={{ fontSize:20, marginBottom:4 }}>📤</div>
              <div style={{ fontWeight:500, color:'#e5e7eb' }}>Upload Source</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>PDF, TXT, or Markdown</div>
            </>
          )}
        </label>

        <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
          {documents.map(doc => (
            <div key={doc.id} style={{ 
              background:'rgba(255, 255, 255, 0.03)', 
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius:10, 
              padding:'10px 12px', 
              fontSize:13, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              transition: 'transform 0.2s'
            }}>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight:500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f3f4f6' }}>
                  {doc.name.endsWith('.pdf') ? '📕' : '📄'} {doc.name}
                </div>
                <div style={{ color:'#6b7280', fontSize:11, marginTop:2 }}>{doc.chunkCount} vector segments</div>
              </div>
              <button 
                onClick={(e) => handleDelete(doc.id, e)}
                style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, opacity: 0.6, transition: 'color 0.2s' }}
                onMouseEnter={e => e.target.style.color = '#ef4444'}
                onMouseLeave={e => e.target.style.color = '#9ca3af'}
              >
                ✕
              </button>
            </div>
          ))}
          {documents.length === 0 && !parsing && (
            <div style={{ fontSize:12, color:'#4b5563', textAlign:'center', padding:'20px 0', fontStyle:'italic' }}>
              No sources uploaded yet
            </div>
          )}
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#1f2937', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👤</div>
            <div style={{ flex:1, overflow: 'hidden' }}>
              <div style={{ fontSize:13, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{session?.user?.email.split('@')[0]}</div>
              <div style={{ fontSize:11, color:'#6b7280' }}>Researcher</div>
            </div>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()} 
            style={{ width: '100%', padding: '10px', background: 'transparent', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 500, transition:'all 0.2s', marginBottom:12 }}
            onMouseEnter={e => { e.target.style.background = 'rgba(239, 68, 68, 0.1)'; e.target.style.color = '#ef4444'; e.target.style.borderColor = 'rgba(239, 68, 68, 0.2)'; }}
            onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#9ca3af'; e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            Sign Out
          </button>

          <div style={{ textAlign:'center', borderTop:'1px solid rgba(255,255,255,0.03)', paddingTop:12 }}>
            <div style={{ fontSize:10, color:'#4b5563', textTransform:'uppercase', letterSpacing:'1px', marginBottom:4 }}>Developed By</div>
            <div style={{ fontSize:13, fontWeight:500, color:'#e5e7eb' }}>Samruddhi Kulkarni</div>
            <div style={{ display:'flex', justifyContent:'center', gap:12, marginTop:8 }}>
              <a href="https://www.linkedin.com/in/samruddhi-kulkarni-31a653261" target="_blank" rel="noreferrer" style={{ color:'#818cf8', textDecoration:'none', fontSize:11, fontWeight:500 }}>LinkedIn</a>
              <a href="https://github.com/Kulkarnisamruddh/Aura-RAG-Research-assistant" target="_blank" rel="noreferrer" style={{ color:'#818cf8', textDecoration:'none', fontSize:11, fontWeight:500 }}>GitHub</a>
            </div>
          </div>
        </div>
      </aside>

      {/* Chat */}
      <div style={s.chat}>
        <header style={s.toolbar}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:'#10b981', boxShadow:'0 0 8px #10b981' }}></div>
            <span style={{ fontSize:12, fontWeight:500, color:'#9ca3af' }}>System Online</span>
          </div>
          <button 
            onClick={async () => {
              if (window.confirm("Clear all messages?")) {
                await supabase.from('chat_messages').delete().eq('user_id', session.user.id);
                setMessages([]);
              }
            }} 
            style={{ padding:'6px 14px', borderRadius:8, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.03)', color:'#9ca3af', cursor:'pointer', fontSize:12, transition:'all 0.2s' }} 
            onMouseEnter={e => e.target.style.background='rgba(255,255,255,0.08)'} 
            onMouseLeave={e => e.target.style.background='rgba(255,255,255,0.03)'}
          >
            Clear Thread
          </button>
        </header>

        {/* Messages */}
        <div style={s.messages}>
          {messages.length === 0 && (
            <div style={{ margin:'auto', textAlign:'center', maxWidth: 460 }}>
              <img src="/logo.png" alt="Aura" style={{ width:80, height:80, marginBottom:24, borderRadius:20, boxShadow:'0 0 40px rgba(99,102,241,0.2)' }} onError={(e) => e.target.style.display='none'} />
              <h2 style={{ fontSize:32, fontWeight:600, color:'#fff', marginBottom:12, letterSpacing:'-1px' }}>Welcome to Aura</h2>
              <p style={{ fontSize:15, color:'#9ca3af', lineHeight: 1.7, marginBottom:32 }}>
                The next generation of AI research. Upload your documents and experience lightning-fast, context-aware intelligence.
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', marginTop:24 }}>
                {['Summarize my documents', 'What are the key findings?', 'Analyze the methodology'].map(t => (
                  <div key={t} onClick={() => { inputRef.current.value = t; sendQuery(); }} style={{ padding:'8px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, fontSize:12, cursor:'pointer', color:'#9ca3af', transition:'all 0.2s' }} onMouseEnter={e => {e.target.style.background='rgba(99,102,241,0.1)'; e.target.style.borderColor='rgba(99,102,241,0.3)'; e.target.style.color='#818cf8'}}>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ 
              display:'flex', 
              gap:16, 
              flexDirection: msg.role==='user' ? 'row-reverse' : 'row', 
              maxWidth:'85%', 
              alignSelf: msg.role==='user' ? 'flex-end' : 'flex-start',
              animation: 'slideIn 0.3s ease-out forwards'
            }}>
              <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              <div style={{ 
                width:34, 
                height:34, 
                borderRadius:10, 
                background: msg.role==='user' ? '#1f2937' : 'linear-gradient(135deg, #6366f1, #a855f7)', 
                display:'flex', 
                alignItems:'center', 
                justifyContent:'center', 
                fontSize:16, 
                flexShrink:0,
                boxShadow: msg.role==='assistant' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
              }}>
                {msg.role === 'user' ? '👤' : '🔬'}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems: msg.role==='user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ 
                  background: msg.role==='user' ? '#6366f1' : 'rgba(255, 255, 255, 0.04)', 
                  border: msg.role==='user' ? 'none' : '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: msg.role==='user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px', 
                  padding:'12px 18px', 
                  fontSize:14, 
                  lineHeight:1.6,
                  color: msg.role==='user' ? '#fff' : '#e5e7eb',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
                }}>
                  {msg.content}
                </div>

                {msg.sources?.length > 0 && (
                  <div style={{ 
                    marginTop:4, 
                    background:'rgba(255, 255, 255, 0.02)', 
                    border:'1px solid rgba(255,255,255,0.05)', 
                    borderRadius:12, 
                    padding:'12px',
                    width: '100%',
                    maxWidth: 400
                  }}>
                    <div style={{ fontSize:10, color:'#6b7280', marginBottom:10, textTransform:'uppercase', letterSpacing:'1px', fontWeight:600 }}>Retrieved Context</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      {msg.sources.map((src, j) => (
                        <div key={j} style={{ fontSize:11, color:'#9ca3af', padding:'8px', background:'rgba(255,255,255,0.02)', borderRadius:8, border:'1px solid rgba(255,255,255,0.03)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                            <span style={{ color:'#818cf8', fontWeight:600 }}>Source {j+1}</span>
                            <span style={{ opacity: 0.5 }}>{Math.round(src.score * 100)}% relevance</span>
                          </div>
                          <div style={{ color:'#d1d5db', lineHeight: 1.4 }}>"{src.text.substring(0, 120)}..."</div>
                          <div style={{ marginTop:4, fontSize:9, color:'#4b5563', textAlign:'right' }}>— {src.docName}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display:'flex', gap:16, alignItems:'center', animation: 'pulse 1.5s infinite' }}>
              <div style={{ width:34, height:34, borderRadius:10, background:'linear-gradient(135deg, #6366f1, #a855f7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🔬</div>
              <div style={{ color:'#6b7280', fontSize:13, fontWeight:500 }}>Analyzing sources & generating response...</div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={s.inputRow}>
          <div style={{...s.inputWrap, ...(inputRef.current?.value ? {borderColor: 'rgba(99,102,241,0.4)', background:'rgba(255,255,255,0.05)'} : {})}}>
            <input ref={inputRef} placeholder="Ask about your documents..."
              onKeyDown={e => e.key === 'Enter' && sendQuery()}
              style={{ flex:1, background:'none', border:'none', outline:'none', color:'#fff', fontSize:14, fontFamily:'inherit' }} />
            <button 
              onClick={sendQuery} 
              disabled={loading} 
              style={{ 
                width:36, 
                height:36, 
                borderRadius:10, 
                background: loading ? '#374151' : '#6366f1', 
                border:'none', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                color:'#fff', 
                fontSize:18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => !loading && (e.target.style.background = '#4f46e5')}
              onMouseLeave={e => !loading && (e.target.style.background = '#6366f1')}
            >
              {loading ? '⋯' : '↑'}
            </button>
          </div>
          <div style={{ textAlign:'center', marginTop:12, fontSize:11, color:'#4b5563' }}>
            RAG Assistant may produce inaccurate information. Verify important facts.
          </div>
        </div>

      </div>
    </div>
  );
}