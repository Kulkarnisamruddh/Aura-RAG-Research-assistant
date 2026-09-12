-- ==============================================================================
-- Aura RAG Assistant — Complete Database Schema & Vector Search Setup
-- ==============================================================================
-- Run this script in your Supabase SQL Editor.
-- ==============================================================================

-- 1. Enable the pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Create the documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT DEFAULT 'local',
  file_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast user_id lookups on documents
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_hash ON documents(user_id, file_hash);

-- 3. Create the document_chunks table with 384-dimensional vector support
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384), -- 384 dimensions for all-MiniLM-L6-v2
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index on document_id foreign key
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);

-- 4. Create HNSW (Hierarchical Navigable Small World) index for fast vector search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 5. Create the chat_messages table for conversation history
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast chat history retrieval ordered by time
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at ASC);

-- 6. Create the vector search RPC function (supports optional document filtering)
DROP FUNCTION IF EXISTS match_document_chunks(vector, double precision, integer, uuid);
DROP FUNCTION IF EXISTS match_document_chunks(vector, float, int, UUID, UUID[]);

CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_user_id UUID,
  filter_document_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity float,
  file_name TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity,
    d.file_name
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = p_user_id
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
    AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Documents RLS
DROP POLICY IF EXISTS "Users can access own documents" ON documents;
CREATE POLICY "Users can access own documents"
ON documents FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Document Chunks RLS
DROP POLICY IF EXISTS "Users can access own chunks" ON document_chunks;
CREATE POLICY "Users can access own chunks"
ON document_chunks FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = document_chunks.document_id 
    AND d.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents d 
    WHERE d.id = document_chunks.document_id 
    AND d.user_id = auth.uid()
  )
);

-- Chat Messages RLS
DROP POLICY IF EXISTS "Users can access own messages" ON chat_messages;
CREATE POLICY "Users can access own messages"
ON chat_messages FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
