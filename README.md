# 🔬 Aura: Secure Production-Grade RAG Research Assistant

A high-performance, full-stack Research Assistant utilizing **Retrieval-Augmented Generation (RAG)**, in-browser edge embeddings, automated LLM-as-a-judge evaluation benchmarks, and containerized deployment.

![Aura Banner](public/screenshot.png)

### 🔗 Live Demo: [aura-rag-research-assistant.vercel.app](https://aura-rag-research-assistant.vercel.app/)
### 🚀 Backend API: [aura-rag-research-assistant.onrender.com](https://aura-rag-research-assistant.onrender.com/health)

---

## 🌟 Key Features

* **⚡ Client-Side Edge Embeddings:** Runs `all-MiniLM-L6-v2` via **ONNX Runtime Web** inside a dedicated **Web Worker**, offloading 100% of embedding computation from the server to the browser.
* **🔎 HNSW Accelerated Vector Search:** Utilizes **Supabase pgvector** with an **HNSW (Hierarchical Navigable Small World)** cosine index for sub-linear $O(\log N)$ nearest-neighbor retrieval.
* **🛡️ Hallucination Guardrails:** Enforces mandatory source citations (`[Source N]`) in generation prompts and flags ungrounded responses in real time with an interactive UI alert badge.
* **📊 LLM-as-a-Judge Evaluation Harness:** Built-in benchmarking suite (`npm run eval`) measuring Faithfulness, Answer Relevance, Citation Compliance, and Negative Out-of-Domain Refusals.
* **📑 Advanced Document Management:** Includes client-side **SHA-256 deduplication hashing**, a 20MB file size safeguard, and document-scoped query filtering via sidebar checkboxes.
* **💬 Rich Markdown & Code Streaming:** Real-time **Server-Sent Events (SSE)** streaming with syntax-highlighted code blocks, tables, copy buttons, and rolling chat history context truncation.
* **🔑 Full Authentication & Password Recovery:** Complete auth lifecycle powered by Supabase with secure password reset callback handling.
* **🐳 Dockerized Deployment:** Multi-stage production `Dockerfile` and `docker-compose.yml` for unified single-command container deployment.

---

## 🛠️ Architecture & Tech Stack

```
[ Client Browser (React 19 + Vite) ]
  ├── Web Worker (ONNX Runtime Web: all-MiniLM-L6-v2) ──> 384-dim Embeddings
  ├── SHA-256 Hashing & Sentence-Aware Chunker
  └── Presentation Layer (Sidebar, DocumentItem, ChatArea, MarkdownMessage)
           │
           ▼ (HTTPS / JWT Authenticated)
[ Express API Server (Node.js) ]
  ├── Rate Limiting (express-rate-limit: 50 req/15 min)
  ├── Server-Side JWT Verification (Supabase Auth)
  ├── Hallucination Guardrail & Citation Verifier
  └── Stream Generator (SSE via Groq SDK)
           │
           ├───► [ Supabase pgvector + PostgreSQL ] (HNSW Cosine Vector Search & RLS)
           └───► [ Groq Cloud ] (Ultra-Fast Inference Engine)
```

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Lucide-style UI | Modular component layout driven by `useAuraState` hook |
| **Embeddings** | `@xenova/transformers` (ONNX Web) | In-browser 384-dimensional vector generation |
| **Backend** | Node.js, Express 5 | JWT-validated streaming endpoints with rate limiting |
| **Database** | PostgreSQL + `pgvector` (Supabase) | HNSW indexed vector storage with Row Level Security (RLS) |
| **LLM Inference** | Groq (`openai/gpt-oss-120b` / LLaMA) | Sub-second token generation with Server-Sent Events |
| **Containerization** | Docker, Docker Compose | Multi-stage `node:20-alpine` build |
| **Evaluation** | Custom LLM-as-a-Judge (`run_evals.js`) | Automated quality benchmarking against ground-truth datasets |

---

## 📊 Evaluation & Benchmark Results

Run the automated evaluation benchmark suite locally:

```bash
npm run eval
```

### Benchmark Summary

| Metric | Score | Target | Status |
| :--- | :--- | :--- | :--- |
| **Faithfulness (Grounding)** | **5.00 / 5.00** | $\ge 4.5$ | 🟢 **PASS** |
| **Answer Relevance** | **5.00 / 5.00** | $\ge 4.5$ | 🟢 **PASS** |
| **Citation Guardrail Compliance** | **100.0%** | $\ge 90\%$ | 🟢 **PASS** |
| **Negative Query Refusal Accuracy** | **100.0%** | $100\%$ | 🟢 **PASS** |
| **Average Inference Latency** | **1332ms** | $< 2000\text{ms}$ | 🟢 **PASS** |

*Detailed benchmark breakdown stored in [`eval/eval_report.md`](eval/eval_report.md).*

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js v18+ or Docker
* Free [Supabase](https://supabase.com) account
* Free [Groq Cloud](https://console.groq.com) API Key

### 2. Installation & Environment Configuration
```bash
git clone https://github.com/Kulkarnisamruddh/Aura-RAG-Research-assistant.git
cd Aura-RAG-Research-assistant
npm install
```

Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

```env
# Backend API URL (for frontend client)
VITE_API_URL=http://localhost:3001/api/chat

# Groq API Key
GROQ_API_KEY=gsk_your_groq_api_key_here

# Supabase Credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Database Initialization
Copy and run the contents of [`setup.sql`](setup.sql) in your **Supabase SQL Editor** to create the tables, HNSW vector index, RLS policies, and vector search function.

### 4. Running Locally

#### Development Mode (Frontend + Backend with Hot Reload)
```bash
npm run dev:full
```
* Client: `http://localhost:5173`
* Server: `http://localhost:3001`

#### Docker Container Mode
```bash
docker compose up --build
```
* Full-stack application accessible at: `http://localhost:3001`

---

## 🔒 Security & Guardrails

1. **Server-Side Identity Verification:** The backend extracts the authenticated user ID directly from verified Supabase JWT tokens (`userSupabase.auth.getUser()`), mitigating request body spoofing.
2. **API Abuse Prevention:** `express-rate-limit` enforces a strict quota of 50 requests per 15-minute window per IP.
3. **Database Tenant Isolation:** PostgreSQL Row Level Security (RLS) policies prevent unauthorized cross-tenant data access on `documents`, `document_chunks`, and `chat_messages`.
4. **Anti-Hallucination Guardrail:** Backend validates whether responses contain source citations from retrieved context and passes alert metadata to the frontend.

---

## 👨‍💻 Author

**Samruddh Kulkarni**  
AI & Data Science Student, MIT Chhatrapati Sambhajinagar  
* [LinkedIn Profile](https://www.linkedin.com/in/samruddhi-kulkarni-31a653261) • [GitHub](https://github.com/Kulkarnisamruddh)
