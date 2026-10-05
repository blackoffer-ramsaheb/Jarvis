# Document RAG functionality
import os
from pathlib import Path
from pypdf import PdfReader
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
VECTOR_DB_PATH = str(DATA_DIR / "vector_db")

_embeddings = None

def get_embeddings():
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2"
        )
    return _embeddings


def extract_pdf_documents(pdf_path: str):
    """Load text documents from a PDF file using PyPDFLoader or PdfReader fallback."""
    try:
        loader = PyPDFLoader(pdf_path)
        docs = loader.load()
        if any(d.page_content.strip() for d in docs):
            return docs
    except Exception as e:
        print(f"PyPDFLoader error, falling back to PdfReader: {e}")

    # Fallback to direct PdfReader
    reader = PdfReader(pdf_path)
    docs = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        if text.strip():
            docs.append(Document(page_content=text, metadata={"source": pdf_path, "page": i}))
    return docs


def create_vector_db(pdf_path: str) -> int:
    """Load a PDF and create or update the FAISS vector database."""
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF file not found at: {pdf_path}")

    documents = extract_pdf_documents(pdf_path)

    if not documents or not any(d.page_content.strip() for d in documents):
        raise ValueError("Could not extract readable text from the PDF. It may be scanned or image-based.")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=100
    )

    chunks = splitter.split_documents(documents)
    if not chunks:
        raise ValueError("Document was empty or could not be chunked.")

    embeddings = get_embeddings()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # If vector db already exists, merge new chunks
    if os.path.exists(VECTOR_DB_PATH):
        try:
            vector_db = FAISS.load_local(
                VECTOR_DB_PATH,
                embeddings,
                allow_dangerous_deserialization=True
            )
            new_db = FAISS.from_documents(chunks, embeddings)
            vector_db.merge_from(new_db)
            vector_db.save_local(VECTOR_DB_PATH)
            return len(chunks)
        except Exception as e:
            print(f"Warning: Could not merge with existing vector DB ({e}), creating fresh index.")

    vector_db = FAISS.from_documents(chunks, embeddings)
    vector_db.save_local(VECTOR_DB_PATH)
    return len(chunks)


def search_documents(query: str, k: int = 4):
    """Search the uploaded document for relevant information."""
    if not os.path.exists(VECTOR_DB_PATH):
        return []

    embeddings = get_embeddings()
    try:
        vector_db = FAISS.load_local(
            VECTOR_DB_PATH,
            embeddings,
            allow_dangerous_deserialization=True
        )
        return vector_db.similarity_search(query, k=k)
    except Exception as e:
        print(f"Error searching vector db: {e}")
        return []