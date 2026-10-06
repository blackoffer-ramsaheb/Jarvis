# J.A.R.V.I.S. AI Assistant (Mark II)

An advanced, Iron Man-inspired AI tactical intelligence assistant featuring LangGraph ReAct agent architecture, Groq LLM inference, multi-turn memory checkpoints, live token streaming via Server-Sent Events (SSE), real-time computer telemetry, multi-format FAISS vector RAG, and an interactive holographic HUD dashboard with Web Audio synthesis and speech recognition.

---

## ⚡ Upgraded Capabilities (Mark II)

- **🧠 Multi-Turn Conversational Memory**: LangGraph `MemorySaver` thread checkpoints and SQLite chat audit logging to remember user context across dialogue turns.
- **⚡ Full-Duplex Real-Time Streaming (SSE)**: Live token-by-token text generation with real-time tool execution banners showing tool inputs and results.
- **📊 Real-Time Hardware Telemetry HUD**: Live gauges monitoring host CPU load %, RAM usage, Disk storage, battery percentage, and operating system state via `psutil`.
- **🛠️ Expanded Tactical Tool Suite (11 Core Tools)**:
  - 🌐 `web_search`: Live internet search for breaking news, events, and information via DuckDuckGo.
  - 📖 `wikipedia_search`: Encyclopedia definitions, concepts, and historical knowledge.
  - 💻 `system_diagnostics`: Real-time hardware telemetry (CPU, RAM, Disk, Battery).
  - 🧮 `calculator`: Scientific math evaluations (`sqrt`, `sin`, `cos`, `pow`, `abs`, etc.).
  - 🐍 `python_sandbox`: Safe Python code runner for math algorithms and data manipulation.
  - 📋 `add_task`: Task creation with priority levels (`high`, `medium`, `low`).
  - 🔍 `list_tasks`: Filter and display pending or completed tasks.
  - ✅ `complete_task`: Mark tasks finished by numeric ID or title keywords.
  - 🗑️ `delete_task`: Remove tasks by ID or keyword.
  - ⏰ `current_datetime`: Live local calendar, day of week, and time.
  - 📚 `search_knowledge`: Semantic vector retrieval with source citations over private files.
- **📚 Multi-Format Knowledge Hub (RAG)**: Ingests and auto-indexes **PDF, DOCX, TXT, MD, and CSV** documents into local FAISS vector store with citation badges and deletion management.
- **📋 Enhanced Interactive Task Board**: Kanban-style status filters (`All`, `Pending`, `Completed`), priority badges (`High`, `Medium`, `Low`), inline checkboxes, and sync controls.
- **🔊 Sci-Fi Web Audio Synthesizer**: Procedural high-tech tone generation for Jarvis boot, message send, tool execution, and voice output cues.

---

## 🚀 Getting Started

### 1. Configure Environment Variables
Verify your `.env` file in the project root:
```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-120b
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run the Server
Start the FastAPI server with Uvicorn:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Access the Dashboard
Open your browser and navigate to:
```
http://localhost:8000
```

---

## 📂 Project Structure

```
├── app/
│   ├── agent.py       # LangGraph ReAct agent, multi-turn MemorySaver, and SSE streaming
│   ├── database.py    # SQLite schema, task priorities, status migrations, & chat persistence
│   ├── llm.py         # Groq ChatGroq LLM connection
│   ├── main.py        # FastAPI routes, SSE streaming, hardware stats, RAG endpoints
│   ├── rag.py         # Multi-format document parser (PDF, DOCX, TXT, CSV) & FAISS vector store
│   └── tools.py       # Expanded tool suite (Web, Wiki, Diagnostics, Tasks, Math, Sandbox)
├── data/
│   ├── documents/     # Uploaded knowledge documents (PDF, DOCX, TXT, CSV)
│   ├── jarvis.db      # SQLite database for tasks and chat logs
│   └── vector_db/     # FAISS vector database store
├── frontend/
│   ├── index.html     # Sci-Fi HUD dashboard with telemetry gauges and tool visualizers
│   ├── script.js      # Frontend controller, SSE stream parser, Web Audio SFX, TTS & STT
│   └── style.css      # Futuristic glassmorphism theme, telemetry meters, and animations
├── requirements.txt   # Complete project dependencies
└── README.md          # System documentation
```
