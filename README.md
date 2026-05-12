A high-performance, full-stack Research Assistant that uses Retrieval-Augmented Generation (RAG) to chat with your documents.

![Aura Screenshot](public/screenshot.png)

### 🔗 Live Demo: [aura-rag-research-assistant.vercel.app](https://aura-rag-research-assistant.vercel.app/)
### 🚀 Backend API: [aura-rag-research-assistant.onrender.com](https://aura-rag-research-assistant.onrender.com/health)

## 🚀 Technical Architecture
- **LLM:** Llama-3.3-70B via **Groq** (Ultra-low latency inference)
- **Vector Database:** **Supabase + pgvector** (Enterprise-grade storage)
- **Embeddings:** **Transformers.js** (Local execution, 384-dim vectors)
- **Backend:** Node.js + Express (Secure JWT-based authentication)
- **Frontend:** React + Vite (Glassmorphism UI / Outfit Typography)

## ✨ Key Features
- **Zero-Latency Embeddings:** Uses `transformers.js` to run AI models **directly in the browser**, saving server costs and ensuring privacy.
- **Secure Document Isolation:** Uses Supabase Row-Level Security (RLS) and JWT tokens to ensure users can only access their own data.
- **Hybrid Context Retrieval:** Combines vector similarity search with semantic context injection.
- **Support for PDF, TXT, and Markdown.**

## 🛠️ Setup & Installation
1. Clone the repo and run `npm install`.
2. Configure your `.env` with Supabase, Groq, and OpenRouter keys.
3. Run the setup SQL in `setup.sql` in your Supabase dashboard.
4. Start the full stack: `npm run dev:full`

---

## 👨‍💻 About the Developer
**Samruddh Kulkarni**
Final year AI&DS student at MIT, Chhatrapati Sambhajinagar.
Passionate about building secure, scalable, and agentic AI systems.

