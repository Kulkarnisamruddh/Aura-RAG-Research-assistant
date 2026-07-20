-- 0. Create HNSW index for high-performance vector search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 1. Add file_hash column to documents table for duplicate detection
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- 2. Update match_document_chunks to support filtering by document IDs
DROP FUNCTION IF EXISTS match_document_chunks;

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
    1 - (dc.embedding <=> query_embedding) AS similarity,
    d.file_name
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = p_user_id
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
    AND (filter_document_ids IS NULL OR d.id = ANY(filter_document_ids))
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
