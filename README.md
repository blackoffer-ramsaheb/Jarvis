# J.A.R.V.I.S. AI Assistant

An advanced, Iron Man-inspired AI personal assistant featuring a LangGraph ReAct agent, Groq LLaMA-3.3 LLM, SQLite task persistence, FAISS vector RAG for PDF knowledge retrieval, and a futuristic web dashboard with speech recognition and synthesis.

---

## ⚡ Key Features

- **Futuristic HUD Web Interface**: Holographic glassmorphism UI with real-time Arc Reactor status visualizer.
- **Interactive Live Chat**: Full markdown support, quick prompt chips, code rendering, and copy actions.
- **Voice Interactions**:
  - **Speech-to-Text (STT)**: Speak directly to Jarvis using your microphone.
  - **Text-to-Speech (TTS)**: Jarvis responds with natural voice output (toggleable).
- **LangGraph ReAct Agent**: Dynamic tool invocation powered by Groq LLaMA-3.3 70B.
- **Tools Included**:
  - 🧮 **Calculator**: Performs arithmetic and mathematical evaluations.
  - 📋 **SQLite Task Manager**: Natural language or direct UI addition, listing, and deletion of tasks.
  - ⏰ **Live System Clock**: Accurate local date and time reports.
  - 📚 **RAG Knowledge Retrieval**: Vector similarity search over indexed PDF documents.
- **Document Hub (RAG)**: Drag-and-drop PDF uploader with automatic FAISS vector indexing.

---

## 🚀 Getting Started

### 1. Configure Environment Variables
Create or edit your `.env` file in the project root:
```env
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Start the FastAPI server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access the Frontend Dashboard
Open your browser and navigate to:
```
http://localhost:8000
```
*(You can also directly open `frontend/index.html` in any browser or live server).*

---

## 📂 Project Structure

```
├── app/
│   ├── agent.py       # LangGraph ReAct Agent definition & execution logic
│   ├── database.py    # SQLite database connection & CRUD operations
│   ├── llm.py         # Groq ChatGroq LLM configuration
│   ├── main.py        # FastAPI endpoints, CORS, RAG upload, static file mounting
│   ├── rag.py         # Document parsing, chunking, and FAISS vector search
│   └── tools.py       # Custom LangChain tools (Calculator, Tasks, Time, RAG)
├── data/
│   ├── documents/     # Uploaded PDF document storage
│   ├── jarvis.db      # SQLite database file
│   └── vector_db/     # FAISS vector database store
├── frontend/
│   ├── index.html     # Jarvis HUD dashboard interface
│   ├── script.js      # Frontend controller, API calls, TTS/STT, task & RAG syncing
│   └── style.css      # Sci-fi themed CSS styling with animations
├── requirements.txt   # Project dependencies
└── README.md          # Documentation
```
