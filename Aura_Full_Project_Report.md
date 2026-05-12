# 🔬 Aura: Comprehensive Project Development Report

**Author:** Samruddh Kulkarni  
**Role:** Lead Developer (Final Year AI&DS student, MIT Chhatrapati Sambhajinagar)  
**Project:** Secure Agentic RAG Research Assistant  

---

## 1. Project Vision
The goal of **Aura** was to create a production-ready Research Assistant capable of performing Retrieval-Augmented Generation (RAG) on private documents with zero infrastructure cost and maximum user privacy.

## 2. Technical Architecture & Technology Justification

### A. Core Intelligence: Groq (Llama 3.3 70B)
*   **Why:** We chose Groq over OpenAI or Anthropic for its **LPU (Language Processing Unit)** architecture. 
*   **Justification:** Groq offers inference speeds exceeding 200 tokens per second. For a research assistant where users expect instant answers from long documents, low latency is the most critical UX factor.

### B. The Database: Supabase + pgvector
*   **Why:** Instead of a standalone vector DB like Pinecone, we used PostgreSQL with the `pgvector` extension.
*   **Justification:** 
    1. **Relational + Vector:** It allows us to store user accounts, chat history, and vector embeddings in a single, unified database.
    2. **Row-Level Security (RLS):** This was the deciding factor. RLS allows us to enforce document isolation at the database level, ensuring User A can never accidentally query User B's documents.

### C. The Embedding Engine: Transformers.js (Edge Computing)
*   **Why:** Initially, we ran embeddings on the Node.js backend. However, we shifted to browser-side execution.
*   **Justification:** Running AI models on the backend requires expensive GPU/RAM resources. By moving the `all-MiniLM-L6-v2` model to the user's browser, we achieved:
    1. **Infinite Scalability:** The server never slows down, no matter how many users are uploading files.
    2. **Privacy:** Documents are processed on the user's machine, not our servers.
    3. **Zero Cost:** No need for expensive embedding APIs.

---

## 3. Development Challenges & Solutions

### Challenge 1: The "Failed Service" (Memory Limits)
During the initial deployment to Render's Free Tier, the server repeatedly crashed with "Out of Memory" errors.
*   **The Cause:** Loading the `transformers.js` model and processing 50+ document chunks exceeded the 512MB RAM limit of the free tier.
*   **The Solution:** We re-engineered the architecture to perform **Browser-Side Embeddings**. The frontend now handles the heavy AI math and sends only the finished vectors to the backend.

### Challenge 2: UI Freezing (Main Thread Blocking)
When the AI model ran in the browser, the website would become unresponsive (the "Page Unresponsive" warning).
*   **The Cause:** JavaScript is single-threaded. Running a 384-dimensional vector calculation for 100 chunks blocked the UI from rendering.
*   **The Solution:** We implemented **Web Workers**. This allows the AI model to run in a background thread, keeping the main UI thread smooth and responsive.

### Challenge 3: Secure Deletion & Persistence
Users found that deleted files would reappear after a refresh.
*   **The Cause:** Missing Row-Level Security (RLS) policies for the `DELETE` operation in Supabase.
*   **The Solution:** We implemented custom SQL policies that explicitly allow users to delete their own rows while blocking others.

---

## 4. Design & UX Strategy
Aura was designed with a **"Premium Dark"** aesthetic to minimize eye strain during long research sessions.
*   **Glassmorphism:** Used semi-transparent sidebars with `backdrop-filter: blur` to create a sense of depth.
*   **Progress Feedback:** Added a real-time progress tracker (`Embedding: 5/66`) to keep the user informed during long document processing.
*   **Streaming Responses:** Implemented Server-Sent Events (SSE) so users see the AI "type" its answer token-by-token, rather than waiting for the whole response.

---

## 5. Deployment Workflow
The project is deployed using a modern, distributed architecture:
1.  **Frontend:** Hosted on **Vercel** for lightning-fast edge delivery.
2.  **Backend:** Hosted on **Render** (Node.js/Express) to handle the logic and API routing.
3.  **Database:** Hosted on **Supabase** (PostgreSQL/pgvector) for secure cloud storage.

---

## 6. Conclusion
Aura demonstrates that with creative engineering—specifically moving AI tasks to the **Edge** (browser)—it is possible to build powerful, secure, and professional AI applications without a massive cloud budget. 

This project stands as a testament to the power of modern web technologies like Web Workers, WASM-powered AI, and Secure Cloud Databases.
