import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse-new');
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
app.use(cors()); // Allow all origins for deployment

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));


const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey: GROQ_API_KEY });
const LLM_MODEL = 'llama-3.3-70b-versatile';

async function chatWithGroq(systemPrompt, messages, res) {
  const stream = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    model: LLM_MODEL,
    temperature: 0.5,
    max_tokens: 1024,
    stream: true,
  });

  let fullResponse = '';
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }
  return fullResponse;
}
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Helper to create an authenticated Supabase client for a specific user request
function getUserSupabase(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('Missing Authorization header');
  
  return createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } }
  });
}

// --- RAG CHUNKING LOGIC ---
// (Now handled on frontend to save server RAM)

// Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// --- RAG CHUNKING LOGIC ---
const CHUNK_SIZE = 300;
function chunkText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  const result = [];
  const step = Math.floor(CHUNK_SIZE * 0.8);
  for (let i = 0; i < words.length; i += step) {
    const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
    if (chunk.trim().length > 20) result.push(chunk);
  }
  return result;
}

// --- API ENDPOINTS ---

app.get('/', (req, res) => res.send('🚀 RAG Assistant Backend is running! Access the frontend at http://localhost:5173'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/upload', async (req, res) => {
  try {
    const { userId, fileName, chunks } = req.body; // Expecting pre-computed chunks with embeddings
    if (!userId || !fileName || !chunks) return res.status(400).json({ error: 'Missing data' });

    console.log(`Saving ${chunks.length} pre-computed chunks for ${fileName}`);

    const userSupabase = getUserSupabase(req);

    const { data: docData, error: docError } = await userSupabase
      .from('documents')
      .insert([{ user_id: userId, file_name: fileName, file_path: 'local' }])
      .select('id')
      .single();

    if (docError) throw docError;
    const documentId = docData.id;

    const records = chunks.map(c => ({
      document_id: documentId,
      content: c.content,
      embedding: c.embedding
    }));

    const { error: chunkError } = await userSupabase.from('document_chunks').insert(records);
    if (chunkError) throw chunkError;

    res.json({ success: true, chunks: records.length, name: fileName, id: documentId });
  } catch (err) {
    console.error('Upload Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userId, queryEmbedding } = req.body; // Receive query embedding from frontend
    if (!userId || !queryEmbedding) return res.status(400).json({ error: 'userId and queryEmbedding are required' });

    const userMessage = messages[messages.length - 1].content;
    console.log(`Searching with pre-computed embedding for: "${userMessage}"`);

    const userSupabase = getUserSupabase(req);

    // 2. Search Supabase vector database
    const { data: searchResults, error: searchError } = await userSupabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 4,
      p_user_id: userId
    });

    if (searchError) throw searchError;

    // 3. Build context for the LLM
    let context = '';
    let sources = [];
    if (searchResults && searchResults.length > 0) {
      context = searchResults.map((r, i) => `[Source ${i + 1}: ${r.file_name}]\n${r.content}`).join('\n\n---\n\n');
      sources = searchResults.map(r => ({ docName: r.file_name, text: r.content, score: r.similarity }));
    }

    const systemPrompt = `You are an expert research assistant. When the user asks a question, use the provided CONTEXT. If it's just a greeting (like "hi"), respond politely. If the user asks a specific question and the answer is not in the context, say "I cannot find the answer in the uploaded documents." Cite your sources using [Source N].\n\nCONTEXT:\n\n${context || 'No documents found.'}`;

    // Deep-strip all non-standard properties (role + content ONLY) before sending to OpenRouter
    const cleanMessages = messages
      .filter(m => m.role && m.content)
      .map(m => ({ role: String(m.role), content: String(m.content) }));

    console.log('Sending to OpenRouter:', JSON.stringify(cleanMessages.map(m => ({ role: m.role, len: m.content.length }))));

    // 4. Set headers for Streaming (SSE)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 5. Generate answer with Groq (Streaming)
    const answer = await chatWithGroq(systemPrompt, cleanMessages, res);

    // 6. Save messages to DB after stream completes
    await userSupabase.from('chat_messages').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: answer, sources: sources }
    ]);

    res.write(`data: [DONE]\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Backend running securely on port ${PORT}`);
});
