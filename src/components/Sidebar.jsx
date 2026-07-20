import DocumentItem from './DocumentItem';

export default function Sidebar({
  documents,
  parsing,
  progress,
  selectedDocuments,
  handleUpload,
  handleDelete,
  toggleDocumentSelection,
  signOut,
  session
}) {
  return (
    <div style={{
      width: 280, 
      background: '#12141a', 
      borderRight: '1px solid #2a2d3a', 
      display: 'flex', 
      flexDirection: 'column', 
      padding: '24px 20px', 
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <div style={{ fontSize: 24 }}>🔬</div>
        <div style={{ fontWeight: 600, fontSize: 18, color: '#e8eaf0', letterSpacing: '-0.02em' }}>Aura</div>
      </div>

      <label style={{ 
        border: '1px dashed rgba(255,255,255,0.15)', 
        borderRadius: 12, 
        padding: '20px 12px', 
        textAlign: 'center', 
        cursor: 'pointer', 
        fontSize: 13, 
        color: parsing ? '#fbbf24' : '#9ca3af', 
        transition: 'all 0.2s',
        background: 'rgba(255,255,255,0.02)' 
      }}>
        <input type="file" multiple accept=".txt,.md,.pdf" onChange={handleUpload} style={{ display: 'none' }} disabled={parsing} />
        {parsing ? (
          <div style={{ animation: 'pulse 1.5s infinite' }}>
            ⏳ <span style={{ fontWeight: 500 }}>{progress || 'Thinking...'}</span>
            <style>{`@keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }`}</style>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 20, marginBottom: 4 }}>📤</div>
            <div style={{ fontWeight: 500, color: '#e5e7eb' }}>Upload Source</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>PDF, TXT, or Markdown</div>
          </>
        )}
      </label>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {documents.map(doc => (
          <DocumentItem 
            key={doc.id}
            doc={doc}
            isSelected={selectedDocuments.has(doc.id)}
            onToggle={toggleDocumentSelection}
            onDelete={handleDelete}
          />
        ))}
        {documents.length === 0 && !parsing && (
          <div style={{ fontSize: 12, color: '#4b5563', textAlign: 'center', padding: '20px 0', fontStyle: 'italic' }}>
            No sources uploaded yet
          </div>
        )}
      </div>

      <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 20 }}>
        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {session.user.email}
        </div>
        <button 
          onClick={signOut}
          style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid #374151', color: '#d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 13, transition: 'background 0.2s' }}
          onMouseEnter={e => e.target.style.background = '#374151'}
          onMouseLeave={e => e.target.style.background = 'transparent'}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
