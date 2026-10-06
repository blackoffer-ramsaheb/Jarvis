# Jarvis agent / LangGraph logic with Memory and Streaming
import json
from typing import Generator, Dict, Any, Optional

from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

from app.llm import llm
from app.tools import tools
from app.database import save_chat_message, clear_chat_history

system_prompt = """You are J.A.R.V.I.S., a sophisticated, witty, and highly intelligent AI personal assistant inspired by Tony Stark's iconic system.

You possess advanced capabilities through your tools:
1. `calculator(expression)`: Evaluate arithmetic and scientific math expressions (supports sqrt, pow, sin, cos, round, etc.).
2. `add_task(task, priority)`: Add a new task or reminder with priority ('low', 'medium', or 'high').
3. `list_tasks(status)`: View pending or completed tasks.
4. `complete_task(identifier)`: Mark a task as completed by its ID or keyword.
5. `delete_task(identifier)`: Delete a task by ID or keyword.
6. `current_datetime()`: Check accurate live local date, time, and day.
7. `system_diagnostics()`: Monitor real-time computer hardware telemetry (CPU, RAM, Disk, Battery, OS).
8. `web_search(query)`: Search the live internet for current news, weather, stock prices, or events via DuckDuckGo.
9. `wikipedia_search(query)`: Lookup encyclopedia summaries for historical, scientific, or general knowledge concepts.
10. `search_knowledge(query)`: Query the local vector database of uploaded documents (PDFs, Word docs, CSVs, company records, Blackcoffer materials) using FAISS semantic search.
11. `python_sandbox(code)`: Execute Python code safely to perform algorithmic calculations, data transformations, or text processing.

Behavioral Directives:
- Address the user respectfully and concisely (e.g., "Certainly, sir" or "Right away").
- Contextual Knowledge: When asked about uploaded documents, company information (e.g., Blackcoffer, internal policies, deliverables), ALWAYS invoke `search_knowledge` first.
- Audio / STT Resilience: Keep in mind that voice input may transcribe phonetically (e.g., "Blackcoffer" as "black copper" or "black offer"). Adapt smoothly.
- Conversational Memory: You remember previous messages within the active session. If the user refers to "it", "that task", or previous statements, use conversational context.
- For casual greetings or brief pleasantries, reply warmly without calling unnecessary tools.
"""

# In-memory checkpointer for conversation threads
checkpointer = MemorySaver()

# Agent instance
agent = create_react_agent(
    model=llm,
    tools=tools,
    prompt=system_prompt,
    checkpointer=checkpointer
)


def ask_jarvis(message: str, session_id: str = "default") -> str:
    """Synchronous invocation of Jarvis with session memory."""
    try:
        # Save user message to persistent DB
        save_chat_message(session_id, "user", message)

        response = agent.invoke(
            {"messages": [("user", message)]},
            config={"configurable": {"thread_id": session_id}}
        )
        last_message = response["messages"][-1]
        reply_content = last_message.content if hasattr(last_message, "content") else str(last_message)

        # Save assistant message to persistent DB
        save_chat_message(session_id, "assistant", reply_content)
        return reply_content
    except Exception as e:
        err_msg = f"Jarvis protocol error: {str(e)}"
        save_chat_message(session_id, "assistant", err_msg)
        return err_msg


def stream_jarvis(message: str, session_id: str = "default") -> Generator[str, None, None]:
    """Stream response tokens and tool execution steps as Server-Sent Events (SSE JSON)."""
    # Save user message to persistent DB
    save_chat_message(session_id, "user", message)
    full_response_acc = []

    try:
        events = agent.stream(
            {"messages": [("user", message)]},
            config={"configurable": {"thread_id": session_id}},
            stream_mode=["messages", "updates"]
        )

        for mode, payload in events:
            if mode == "updates":
                # Check for tool invocations or tool results
                for node_name, data in payload.items():
                    for msg in data.get("messages", []):
                        # Tool start
                        if getattr(msg, "tool_calls", None):
                            for tc in msg.tool_calls:
                                yield f"data: {json.dumps({'type': 'tool_start', 'name': tc.get('name'), 'args': tc.get('args', {})})}\n\n"
                        # Tool completed
                        elif type(msg).__name__ == "ToolMessage":
                            tool_name = getattr(msg, "name", "tool")
                            content_preview = str(msg.content)[:250] + ("..." if len(str(msg.content)) > 250 else "")
                            yield f"data: {json.dumps({'type': 'tool_end', 'name': tool_name, 'output': content_preview})}\n\n"

            elif mode == "messages":
                msg, meta = payload
                # Only stream final agent output tokens (skip tool call intermediate message empty content)
                if meta.get("langgraph_node") == "agent" and not getattr(msg, "tool_calls", None):
                    if isinstance(msg.content, str) and msg.content:
                        full_response_acc.append(msg.content)
                        yield f"data: {json.dumps({'type': 'token', 'content': msg.content})}\n\n"

        complete_text = "".join(full_response_acc).strip()
        if complete_text:
            save_chat_message(session_id, "assistant", complete_text)

        yield f"data: {json.dumps({'type': 'done', 'content': complete_text})}\n\n"

    except Exception as e:
        err_msg = f"System error during execution: {str(e)}"
        save_chat_message(session_id, "assistant", err_msg)
        yield f"data: {json.dumps({'type': 'error', 'content': err_msg})}\n\n"


def reset_session_memory(session_id: str) -> bool:
    """Clear in-memory LangGraph state and SQLite history for a given session."""
    clear_chat_history(session_id)
    # Reset thread state in checkpointer
    try:
        checkpointer.storage.pop(session_id, None)
    except Exception:
        pass
    return True