import os
import traceback
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.agent import ask_jarvis
from app.rag import create_vector_db
from app.database import init_db, get_tasks, add_task, delete_task

app = FastAPI(title="Jarvis AI Assistant", version="1.0.0")

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

# Initialize database
init_db()


class ChatRequest(BaseModel):
    message: str


class TaskCreateRequest(BaseModel):
    task: str


# API Routes
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "JARVIS Protocol Active",
        "version": "1.0.0"
    }


@app.post("/ask")
def ask(payload: ChatRequest):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    answer = ask_jarvis(payload.message)
    return {
        "question": payload.message,
        "answer": answer
    }


@app.get("/tasks")
def list_user_tasks():
    return {
        "tasks": get_tasks()
    }


@app.post("/tasks")
def create_user_task(payload: TaskCreateRequest):
    if not payload.task.strip():
        raise HTTPException(status_code=400, detail="Task description cannot be empty")
    
    task_id = add_task(payload.task.strip())
    return {
        "message": "Task added successfully",
        "task_id": task_id,
        "tasks": get_tasks()
    }


@app.delete("/tasks/{task_id}")
def remove_user_task(task_id: int):
    deleted = delete_task(task_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": f"Task {task_id} deleted successfully",
        "tasks": get_tasks()
    }


@app.get("/documents")
def list_documents():
    docs = []
    if DOCS_DIR.exists():
        for f in DOCS_DIR.iterdir():
            if f.is_file() and f.suffix.lower() == ".pdf":
                docs.append({
                    "filename": f.name,
                    "size_kb": round(f.stat().st_size / 1024, 2)
                })
    return {"documents": docs}


@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are currently supported for knowledge indexing.")

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
