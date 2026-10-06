import os
import platform
import traceback
from pathlib import Path
from typing import Optional

import psutil
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.agent import ask_jarvis, stream_jarvis, reset_session_memory
from app.rag import (
    create_vector_db,
    delete_document_file,
    clear_knowledge_base,
    rebuild_vector_db_from_scratch
)
from app.database import (
    init_db,
    get_tasks,
    add_task,
    update_task_status,
    delete_task,
    get_chat_history
)

app = FastAPI(
    title="J.A.R.V.I.S. AI Assistant",
    description="Autonomous Tactical Intelligence Assistant with LangGraph ReAct, RAG, and Real-Time Hardware Telemetry",
    version="2.0.0"
)

# Setup CORS for web frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
DOCS_DIR = BASE_DIR / "data" / "documents"
DOCS_DIR.mkdir(parents=True, exist_ok=True)

# Initialize database schema
init_db()


# --- Pydantic Request Models ---

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default"


class TaskCreateRequest(BaseModel):
    task: str
    priority: Optional[str] = "medium"


class TaskStatusUpdateRequest(BaseModel):
    status: str


# --- API Routes ---

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "JARVIS Mark II Tactical Intelligence Active",
        "version": "2.0.0"
    }


@app.get("/system/stats")
def get_system_stats():
    """Real-time system telemetry for HUD dashboard meters."""
    try:
        cpu_pct = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        battery_pct = None
        is_charging = False
        if hasattr(psutil, "sensors_battery") and psutil.sensors_battery():
            batt = psutil.sensors_battery()
            battery_pct = batt.percent
            is_charging = batt.power_plugged

        return {
            "os": f"{platform.system()} {platform.release()}",
            "cpu_percent": cpu_pct,
            "ram_used_gb": round(ram.used / (1024**3), 2),
            "ram_total_gb": round(ram.total / (1024**3), 2),
            "ram_percent": ram.percent,
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_percent": disk.percent,
            "battery_percent": battery_pct,
            "is_charging": is_charging
        }
    except Exception as e:
        return {"error": str(e), "cpu_percent": 0, "ram_percent": 0, "disk_percent": 0}


# --- Chat Endpoints ---

@app.post("/ask")
def ask(payload: ChatRequest):
    """Synchronous chat endpoint with session memory."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = payload.session_id or "default"
    answer = ask_jarvis(payload.message.strip(), session_id=session_id)
    return {
        "session_id": session_id,
        "question": payload.message,
        "answer": answer
    }


@app.post("/ask/stream")
def ask_stream(payload: ChatRequest):
    """Streaming chat endpoint via Server-Sent Events (SSE)."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = payload.session_id or "default"
    return StreamingResponse(
        stream_jarvis(payload.message.strip(), session_id=session_id),
        media_type="text/event-stream"
    )


@app.get("/chat/history")
def get_session_history(session_id: str = Query("default")):
    """Retrieve persistent conversation history for a session."""
    history = get_chat_history(session_id, limit=50)
    return {"session_id": session_id, "messages": history}


@app.delete("/chat/history")
def clear_session_history(session_id: str = Query("default")):
    """Clear conversation history and in-memory agent state for a session."""
    reset_session_memory(session_id)
    return {"message": f"Session memory '{session_id}' cleared successfully"}


# --- Task Endpoints ---

@app.get("/tasks")
def list_user_tasks(status: Optional[str] = Query(None)):
    """Retrieve tasks with optional status filter ('pending', 'completed', 'all')."""
    return {
        "tasks": get_tasks(status=status)
    }


@app.post("/tasks")
def create_user_task(payload: TaskCreateRequest):
    """Create a new task with optional priority ('low', 'medium', 'high')."""
    if not payload.task.strip():
        raise HTTPException(status_code=400, detail="Task description cannot be empty")

    task_id = add_task(payload.task.strip(), priority=payload.priority or "medium")
    return {
        "message": "Task added successfully",
        "task_id": task_id,
        "tasks": get_tasks()
    }


@app.patch("/tasks/{task_id}/status")
def set_task_status(task_id: int, payload: TaskStatusUpdateRequest):
    """Update task status ('pending', 'in_progress', 'completed')."""
    updated = update_task_status(task_id, payload.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": f"Task {task_id} updated to {payload.status}",
        "tasks": get_tasks()
    }


@app.delete("/tasks/{task_id}")
def remove_user_task(task_id: int):
    """Delete a task by ID."""
    deleted = delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": f"Task {task_id} deleted successfully",
        "tasks": get_tasks()
    }


# --- Document & Knowledge Base Endpoints ---

@app.get("/documents")
def list_documents():
    """List all knowledge documents in the library."""
    docs = []
    if DOCS_DIR.exists():
        for f in DOCS_DIR.iterdir():
            if f.is_file():
                docs.append({
                    "filename": f.name,
                    "extension": f.suffix.lower(),
                    "size_kb": round(f.stat().st_size / 1024, 2)
                })
    return {"documents": docs}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and index documents (.pdf, .docx, .txt, .md, .csv)."""
    allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".md", ".csv"}
    ext = Path(file.filename).suffix.lower()
    if not file.filename or ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported format '{ext}'. Supported: {', '.join(allowed_exts)}"
        )

    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    file_path = DOCS_DIR / file.filename

    try:
        content = await file.read()
        with open(file_path, "wb") as buffer:
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    try:
        chunks = create_vector_db(str(file_path))
        return {
            "message": "Document uploaded and indexed successfully",
            "filename": file.filename,
            "chunks": chunks
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to index document: {str(e)}")


@app.delete("/documents/{filename}")
def delete_document(filename: str):
    """Delete a document and re-index the remaining files."""
    deleted = delete_document_file(filename)
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"message": f"Document '{filename}' deleted and index updated."}


@app.post("/documents/reset")
def reset_knowledge():
    """Purge all documents and reset the vector store."""
    clear_knowledge_base()
    return {"message": "Knowledge base wiped and reset."}


# Serve Frontend Static Assets
frontend_dir = BASE_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = frontend_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "Jarvis API is running. Frontend index.html not found."}
