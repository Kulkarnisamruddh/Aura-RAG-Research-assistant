-- 1. Create the documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the document_chunks table with vector support
-- Make sure to enable the pgvector extension first:
-- CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(384), -- 384 dimensions for all-MiniLM-L6-v2
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create the vector search function
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_user_id UUID
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
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.file_name
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = p_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- 4. Create the messages table for chat history
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

