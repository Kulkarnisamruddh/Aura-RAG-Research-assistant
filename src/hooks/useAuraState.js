import { useState, useRef, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export function useAuraState(session) {
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [progress, setProgress]   = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());
  const workerRef                 = useRef(null);
  const inputRef                  = useRef(null);

  // Initialize Worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../worker.js', import.meta.url), { type: 'module' });
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

  function chunkText(text) {
    const CHUNK_SIZE = 300;
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const result = [];
    let currentChunk = '';
    let lastSentence = '';

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      const currentWords = currentChunk.split(/\s+/).filter(Boolean).length;

      if (currentWords + sentenceWords > CHUNK_SIZE && currentWords > 20) {
        result.push(currentChunk.trim());
        currentChunk = (lastSentence ? lastSentence + ' ' : '') + sentence + ' ';
      } else {
        currentChunk += sentence + ' ';
      }
      lastSentence = sentence;
    }
    
    if (currentChunk.trim().length > 20) {
      result.push(currentChunk.trim());
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

  async function calculateHash(file) {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setParsing(true);
    setProgress('Preparing files...');

    try {
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) {
          alert(`❌ Error: ${file.name} is larger than 20MB.`);
          continue;
        }

        setProgress(`Hashing ${file.name}...`);
        const fileHash = await calculateHash(file);

        const text = await extractText(file);
        if (!text.trim()) continue;

        const chunks = chunkText(text);
        
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

        setProgress('Saving to cloud...');
        const res = await fetch(import.meta.env.VITE_API_URL.replace('/chat', '/upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ 
            fileName: file.name, 
            chunks: processedChunks,
            fileHash: fileHash
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
      setSelectedDocuments(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    } catch (err) {
      alert(`❌ Failed to delete document: ${err.message}`);
    }
  }

  function toggleDocumentSelection(docId) {
    setSelectedDocuments(prev => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
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
          queryEmbedding: queryEmbedding,
          documentIds: selectedDocuments.size > 0 ? Array.from(selectedDocuments) : undefined
        }),
      });

      if (!response.ok) throw new Error('Server error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      
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

  return {
    documents,
    messages,
    loading,
    parsing,
    progress,
    selectedDocuments,
    inputRef,
    handleUpload,
    handleDelete,
    sendQuery,
    toggleDocumentSelection,
    signOut: () => supabase.auth.signOut()
  };
}
