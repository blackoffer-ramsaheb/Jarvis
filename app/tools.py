# Jarvis tools module
import io
import math
import platform
import sys
import psutil
from datetime import datetime
from langchain_core.tools import tool

from app.database import (
    add_task as db_add_task,
    get_tasks as db_get_tasks,
    update_task_status as db_update_status,
    delete_task as db_delete_task,
    find_task_by_keyword
)
from app.rag import search_documents

# Try importing ddgs & wikipedia
try:
    from ddgs import DDGS
except ImportError:
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        DDGS = None

try:
    import wikipedia
except ImportError:
    wikipedia = None


@tool
def calculator(expression: str) -> str:
    """Calculate a mathematical or scientific expression.
    Supports basic arithmetic and standard math functions (sqrt, pow, sin, cos, tan, log, abs, round, pi, e).
    Example: 'sqrt(144) + 25 * 4' or 'round(150 * 1.18, 2)'."""
    try:
        safe_dict = {
            "sqrt": math.sqrt,
            "sin": math.sin,
            "cos": math.cos,
            "tan": math.tan,
            "log": math.log,
            "exp": math.exp,
            "pow": math.pow,
            "abs": abs,
            "round": round,
            "pi": math.pi,
            "e": math.e,
            "__builtins__": {}
        }
        # Allow numbers, operators, parens, standard identifiers
        cleaned = expression.strip()
        result = eval(cleaned, {"__builtins__": {}}, safe_dict)
        return f"Calculation Result: {result}"
    except Exception as e:
        return f"Error evaluating expression '{expression}': {str(e)}"


@tool
def add_task(task: str, priority: str = "medium") -> str:
    """Add a new task or reminder to the user's task list.
    Priority can be 'low', 'medium', or 'high' (default is 'medium')."""
    clean_prio = priority.lower().strip() if priority.lower().strip() in ["low", "medium", "high"] else "medium"
    task_id = db_add_task(task, priority=clean_prio)
    return f"Task #{task_id} successfully added: '{task}' [Priority: {clean_prio.upper()}]."


@tool
def list_tasks(status: str = "all") -> str:
    """List tasks stored in the system.
    status parameter can be 'all', 'pending', or 'completed'."""
    tasks = db_get_tasks(status=status)
    if not tasks:
        filter_str = f" with status '{status}'" if status != "all" else ""
        return f"No tasks found{filter_str}."

    lines = []
    for t in tasks:
        icon = "[x]" if t["status"] == "completed" else "[ ]"
        prio_tag = f"({t['priority'].upper()})"
        lines.append(f"{icon} #{t['id']}: {t['task']} {prio_tag} - Status: {t['status'].capitalize()} (Created: {t['created_at']})")

    return f"Tasks ({len(tasks)} items):\n" + "\n".join(lines)


@tool
def complete_task(identifier: str) -> str:
    """Mark a task as completed using either its task ID number (e.g. '3') or keywords from the task title (e.g. 'buy groceries')."""
    cleaned = identifier.strip()
    if cleaned.isdigit():
        task_id = int(cleaned)
        updated = db_update_status(task_id, "completed")
        if updated:
            return f"Task #{task_id} has been marked as COMPLETED."
        return f"Task #{task_id} was not found."

    # Search by keyword
    matched = find_task_by_keyword(cleaned)
    if matched:
        db_update_status(matched["id"], "completed")
        return f"Task #{matched['id']} ('{matched['task']}') marked as COMPLETED."
    return f"Could not find any task matching '{identifier}'."


@tool
def delete_task(identifier: str) -> str:
    """Delete a task from the database using either its numeric ID (e.g. '2') or a keyword matching its title."""
    cleaned = identifier.strip()
    if cleaned.isdigit():
        task_id = int(cleaned)
        deleted = db_delete_task(task_id)
        if deleted:
            return f"Task #{task_id} was deleted successfully."
        return f"Task #{task_id} was not found."

    matched = find_task_by_keyword(cleaned)
    if matched:
        db_delete_task(matched["id"])
        return f"Task #{matched['id']} ('{matched['task']}') has been deleted."
    return f"Could not find any task matching '{identifier}' to delete."


@tool
def current_datetime() -> str:
    """Get the current live local date, day of the week, time, and timezone information."""
    now = datetime.now()
    return f"Current System Time: {now.strftime('%A, %d %B %Y | %I:%M:%S %p')} (Local Time)"


@tool
def system_diagnostics() -> str:
    """Retrieve real-time computer hardware telemetry: CPU load percentage, RAM memory usage, Disk storage, battery percentage, and operating system info."""
    try:
        cpu_pct = psutil.cpu_percent(interval=0.5)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        battery_info = "N/A (Desktop / AC Connected)"
        if hasattr(psutil, "sensors_battery") and psutil.sensors_battery():
            batt = psutil.sensors_battery()
            plugged = "Plugged in" if batt.power_plugged else "On battery"
            battery_info = f"{batt.percent}% ({plugged})"

        return (
            f"JARVIS System Telemetry Report:\n"
            f"- OS: {platform.system()} {platform.release()} ({platform.machine()})\n"
            f"- CPU Utilization: {cpu_pct}%\n"
            f"- Memory (RAM): {round(ram.used / (1024**3), 2)} GB used of {round(ram.total / (1024**3), 2)} GB ({ram.percent}%)\n"
            f"- Disk Storage: {round(disk.used / (1024**3), 2)} GB used of {round(disk.total / (1024**3), 2)} GB ({disk.percent}% used)\n"
            f"- Battery Status: {battery_info}"
        )
    except Exception as e:
        return f"Error retrieving system telemetry: {str(e)}"


@tool
def web_search(query: str) -> str:
    """Search the public live internet for real-time information, breaking news, weather, stock prices, or events using DuckDuckGo."""
    if not DDGS:
        return "Web search module is currently unavailable."
    try:
        results = []
        with DDGS() as ddgs:
            raw = list(ddgs.text(query, max_results=4))
            for item in raw:
                title = item.get("title", "")
                snippet = item.get("body", "")
                link = item.get("href", "")
                results.append(f"- **{title}**: {snippet}\n  Source: {link}")
        if results:
            return f"Web Search Results for '{query}':\n\n" + "\n\n".join(results)
        return f"No relevant web search results found for '{query}'."
    except Exception as e:
        return f"Web search encountered an error: {str(e)}"


@tool
def wikipedia_search(query: str) -> str:
    """Search Wikipedia for definitions, encyclopedia summaries, biographies, historical events, and scientific concepts."""
    if not wikipedia:
        return "Wikipedia search module is not available."
    try:
        summary = wikipedia.summary(query, sentences=3, auto_suggest=False)
        return f"Wikipedia Summary for '{query}':\n{summary}"
    except Exception as e:
        try:
            # Try search candidates
            results = wikipedia.search(query, results=3)
            if results:
                summary = wikipedia.summary(results[0], sentences=3, auto_suggest=False)
                return f"Wikipedia Summary for '{results[0]}':\n{summary}"
        except Exception:
            pass
        return f"Could not locate Wikipedia article for '{query}'."


@tool
def search_knowledge(query: str) -> str:
    """Search uploaded knowledge base documents (PDFs, Word docs, text files, FAQs, Blackcoffer materials) using FAISS semantic vector search. Always use this whenever the user asks about uploaded files, company information, FAQs, or private documents."""
    docs = search_documents(query, k=3)
    if not docs:
        return "No relevant information found in the uploaded knowledge documents."

    formatted = []
    for d in docs:
        citation = d.get("citation", "[Document]")
        content = d.get("content", "")
        formatted.append(f"{citation}:\n{content}")

    return f"Knowledge Base Excerpts for '{query}':\n\n" + "\n\n---\n\n".join(formatted)


@tool
def python_sandbox(code: str) -> str:
    """Safely execute small Python code snippets for calculations, data formatting, algorithmic problem-solving, or text transformation, and return stdout output."""
    try:
        old_stdout = sys.stdout
        redirected_output = io.StringIO()
        sys.stdout = redirected_output

        safe_globals = {
            "math": math,
            "datetime": datetime,
            "__builtins__": {
                "print": print,
                "range": range,
                "len": len,
                "str": str,
                "int": int,
                "float": float,
                "list": list,
                "dict": dict,
                "set": set,
                "sum": sum,
                "min": min,
                "max": max,
                "sorted": sorted,
                "abs": abs,
                "round": round,
                "enumerate": enumerate,
                "zip": zip,
            }
        }
        exec(code, safe_globals)
        sys.stdout = old_stdout
        output = redirected_output.getvalue().strip()
        return output if output else "Code executed successfully with no output."
    except Exception as e:
        sys.stdout = old_stdout
        return f"Python execution error: {str(e)}"


# Export tools registry
tools = [
    calculator,
    add_task,
    list_tasks,
    complete_task,
    delete_task,
    current_datetime,
    system_diagnostics,
    web_search,
    wikipedia_search,
    search_knowledge,
    python_sandbox
]