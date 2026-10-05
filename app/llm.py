# Groq LLM configuration
import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

groq_api_key = os.getenv("GROQ_API_KEY", "")
groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

llm = ChatGroq(
    model=groq_model,
    temperature=0.3,
    api_key=groq_api_key if groq_api_key else "gsk_dummy_key"
)