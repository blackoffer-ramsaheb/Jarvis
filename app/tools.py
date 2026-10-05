# Jarvis tools
from datetime import datetime
from langchain_core.tools import tool
from app.database import add_task as save_task, get_tasks as fetch_tasks
from app.rag import search_documents


@tool
def calculator(expression: str) -> str:
    """Calculate a mathematical expression. Input should be a valid math string like '2 + 2' or '50 * 12'."""
    try:
        # safe evaluation for basic arithmetic
        allowed_chars = set("0123456789+-*/(). %^e")
        if not all(c in allowed_chars for c in expression.replace(" ", "")):
            return "Invalid mathematical characters used."
        result = eval(expression, {"__builtins__": {}})
        return str(result)
    except Exception as e:
        return f"Error evaluating expression: {e}"


@tool
def add_task(task: str) -> str:
    """Add a new task or reminder to the user's task list."""
    save_task(task)
    return f"Task added successfully: '{task}'"


@tool
def list_tasks() -> str:
    """Return all pending user tasks stored in the database."""
    tasks = fetch_tasks()
    if not tasks:
        return "You currently have no tasks in your list."

    lines = [f"{t['id']}. {t['task']} (Added: {t['created_at']})" for t in tasks]
    return "Current tasks:\n" + "\n".join(lines)


@tool
def current_datetime() -> str:
    """Get the current local date, day of the week, and time."""
    return datetime.now().strftime("%A, %d %B %Y, %I:%M:%S %p")


@tool
def search_knowledge(query: str) -> str:
    """Search uploaded knowledge documents / PDFs for relevant context, FAQs, company information (e.g. Blackcoffer), policies, and answers. ALWAYS use this tool whenever the user asks questions about uploaded documents, company information, or domain-specific facts."""
    docs = search_documents(query, k=3)
    if not docs:
        return "No relevant information found in the uploaded documents."
    
    extracted = "\n---\n".join([d.page_content for d in docs])
    return f"Document excerpts related to '{query}':\n{extracted}"


# All tools available to Jarvis
tools = [
    calculator,
    add_task,
    list_tasks,
    current_datetime,
    search_knowledge
]