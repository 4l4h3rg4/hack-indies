FROM python:3.12-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir fastapi 'uvicorn[standard]' google-adk google-genai mcp supabase pydantic pydantic-settings httpx sse-starlette python-multipart apscheduler openai pynacl slowapi

COPY src/ ./src/

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
