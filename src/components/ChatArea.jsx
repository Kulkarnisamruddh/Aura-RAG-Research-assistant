import MarkdownMessage from '../MarkdownMessage';

export default function ChatArea({
  messages,
  loading,
  inputRef,
  sendQuery
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0c10', position: 'relative' }}>
      {/* Header */}
      <div style={{ padding: '20px 32px', borderBottom: '1px solid #1a1d24', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(10, 12, 16, 0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 500, color: '#e8eaf0' }}>Research Assistant</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#10b981' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></div>
          System Online
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: 24, scrollBehavior: 'smooth' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#6b7280', maxWidth: 400 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <h3 style={{ color: '#e5e7eb', marginBottom: 8 }}>Ready to assist</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>Upload documents on the left, then ask me anything. I will search through your sources to find the answers.</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              animation: 'fadeIn 0.3s ease-out'
            }}>
              <div style={{ 
                maxWidth: '80%', 
                padding: '16px 20px', 
                borderRadius: 16,
                background: msg.role === 'user' ? 'linear-gradient(135deg, #4f8ef7, #7c6cf7)' : '#1a1d24',
                color: msg.role === 'user' ? '#fff' : '#e8eaf0',
                border: msg.role === 'user' ? 'none' : '1px solid #2a2d3a',
                borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                borderBottomLeftRadius: msg.role === 'user' ? 16 : 4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                {msg.role === 'user' ? (
                  <div style={{ lineHeight: 1.6, fontSize: 15 }}>{msg.content}</div>
                ) : (
                  <MarkdownMessage content={msg.content} />
                )}
              </div>
              
              {msg.sources && msg.sources.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '80%' }}>
                  {msg.sources.map((s, idx) => (
                    <div key={idx} style={{ fontSize: 11, background: '#12141a', border: '1px solid #2a2d3a', padding: '4px 8px', borderRadius: 4, color: '#9ca3af' }}>
                      📄 {s.docName} ({(s.score * 100).toFixed(0)}%)
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', gap: 8, padding: '16px 20px', background: '#1a1d24', borderRadius: 16, width: 'fit-content', border: '1px solid #2a2d3a', borderBottomLeftRadius: 4 }}>
            <div className="dot-typing"></div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '24px 32px', background: 'linear-gradient(to top, #0a0c10 80%, transparent)' }}>
        <div style={{ 
          display: 'flex', 
          background: '#12141a', 
          border: '1px solid #2a2d3a', 
          borderRadius: 12, 
          padding: '8px 16px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          transition: 'border-color 0.2s'
        }}>
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Ask a question about your documents..." 
            onKeyDown={e => e.key === 'Enter' && sendQuery()}
            disabled={loading}
            style={{ 
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: '#e8eaf0', 
              outline: 'none', 
              fontSize: 15,
              padding: '8px 0'
            }}
          />
          <button 
            onClick={sendQuery} 
            disabled={loading}
            style={{ 
              background: loading ? '#374151' : 'linear-gradient(135deg, #4f8ef7, #7c6cf7)', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 8, 
              padding: '8px 16px', 
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginLeft: 12,
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </div>

      <style>{`
        .dot-typing {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: #6b7280;
          box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #6b7280;
          animation: dot-typing 1.5s infinite linear;
          margin-right: 24px;
        }
        @keyframes dot-typing {
          0% { box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #6b7280; }
          16.667% { background-color: #e5e7eb; box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #6b7280; }
          33.333% { background-color: #6b7280; box-shadow: 12px 0 0 0 #e5e7eb, 24px 0 0 0 #6b7280; }
          50% { background-color: #6b7280; box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #e5e7eb; }
          66.667% { background-color: #6b7280; box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #6b7280; }
          100% { box-shadow: 12px 0 0 0 #6b7280, 24px 0 0 0 #6b7280; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
