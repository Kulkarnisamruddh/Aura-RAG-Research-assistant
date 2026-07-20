import { useAuraState } from './hooks/useAuraState';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';

export default function App({ session }) {
  const auraState = useAuraState(session);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0c10', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar 
        documents={auraState.documents}
        parsing={auraState.parsing}
        progress={auraState.progress}
        selectedDocuments={auraState.selectedDocuments}
        handleUpload={auraState.handleUpload}
        handleDelete={auraState.handleDelete}
        toggleDocumentSelection={auraState.toggleDocumentSelection}
        signOut={auraState.signOut}
        session={session}
      />
      <ChatArea 
        messages={auraState.messages}
        loading={auraState.loading}
        inputRef={auraState.inputRef}
        sendQuery={auraState.sendQuery}
      />
    </div>
  );
}