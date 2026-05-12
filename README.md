# 🔬 Aura: Secure Agentic RAG Research Assistant

A high-performance, full-stack Research Assistant that uses Retrieval-Augmented Generation (RAG) to chat with your documents.

![Aura Screenshot](public/screenshot.png)

### 🔗 Live Demo: [aura-rag-research-assistant.vercel.app](https://aura-rag-research-assistant.vercel.app/)
### 🚀 Backend API: [aura-rag-research-assistant.onrender.com](https://aura-rag-research-assistant.onrender.com/health)

---

## 🛠️ Engineering Highlights & Optimizations

This project features several advanced technical decisions made to optimize for performance, scalability, and cost-efficiency on cloud platforms:

### ⚡ Edge Computing (Browser-Side RAG)
To handle the memory-intensive task of generating high-dimensional embeddings on a limited-resource server (Render Free Tier), I implemented **Browser-Side Embeddings**. 
- **The Tech:** Uses `transformers.js` (Xenova/all-MiniLM-L6-v2) running directly in the user's browser.
- **The Benefit:** Offloads 100% of the embedding CPU/RAM cost to the client, allowing the backend to remain ultra-lightweight and scale infinitely for free.

### 🧵 Multi-Threaded UI (Web Workers)
AI model execution can block the main JavaScript thread, causing the UI to freeze. I integrated **Web Workers** to offload the AI processing.
- **Result:** The UI remains perfectly responsive (scrolling, clicking, animations) while the background thread handles the heavy mathematical computations for the embeddings.

### 🛡️ Enterprise-Grade Security
- **Document Isolation:** Uses **Supabase Row-Level Security (RLS)** policies to ensure users can only access their own documents and chat history.
- **Stateless Authentication:** Secure JWT-based communication between the React frontend and Node.js backend.

---

## 🚀 Technical Architecture
- **LLM:** Llama-3.3-70B via **Groq** (Ultra-low latency inference)
- **Vector Database:** **Supabase + pgvector** (Enterprise-grade storage)
- **Embeddings:** **Transformers.js** (Edge execution, 384-dim vectors)
- **Backend:** Node.js + Express (Stream-based SSE responses)
- **Frontend:** React 19 + Vite (Glassmorphism UI / Outfit Typography)

## ✨ Key Features
- **Hybrid Context Retrieval:** Combines vector similarity search with semantic context injection.
- **Live Streaming Responses:** Uses Server-Sent Events (SSE) for real-time token streaming.
- **Local PDF Processing:** High-speed browser-side text extraction using `pdfjs-dist`.

## 🛠️ Setup & Installation
1. Clone the repo and run `npm install`.
2. Configure your `.env` with Supabase and Groq keys.
3. Run the setup SQL in `setup.sql` in your Supabase dashboard.
4. Start the full stack: `npm run dev:full`

---

## 👨‍💻 About the Developer
**Samruddh Kulkarni**
Final year AI&DS student at MIT, Chhatrapati Sambhajinagar.
Passionate about building secure, scalable, and agentic AI systems.
[LinkedIn Profile](https://www.linkedin.com/in/samruddhi-kulkarni-31a653261)
