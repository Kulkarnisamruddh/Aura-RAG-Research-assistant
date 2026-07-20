export default function DocumentItem({ doc, isSelected, onToggle, onDelete }) {
  return (
    <div 
      style={{ 
        background: 'rgba(255, 255, 255, 0.03)', 
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 10, 
        padding: '10px 12px', 
        fontSize: 13, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        transition: 'transform 0.2s',
        cursor: 'pointer'
      }}
      onClick={() => onToggle(doc.id)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
        <input 
          type="checkbox" 
          checked={isSelected} 
          readOnly 
          style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }}
        />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f3f4f6' }}>
            {doc.name.endsWith('.pdf') ? '📕' : '📄'} {doc.name}
          </div>
          <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
            {doc.chunkCount} vector segments
          </div>
        </div>
      </div>
      <button 
        onClick={(e) => onDelete(doc.id, e)}
        style={{ 
          background: 'transparent', 
          border: 'none', 
          color: '#9ca3af', 
          cursor: 'pointer', 
          padding: 4, 
          opacity: 0.6, 
          transition: 'color 0.2s' 
        }}
        onMouseEnter={e => e.target.style.color = '#ef4444'}
        onMouseLeave={e => e.target.style.color = '#9ca3af'}
      >
        ✕
      </button>
    </div>
  );
}
