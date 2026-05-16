FROM python:3.12-slim

WORKDIR /app

# Install Node.js 20 for MCP stdio connectors (npx)
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
# NOTE: Keep this list in sync with pyproject.toml dependencies
RUN pip install --no-cache-dir \
  fastapi "uvicorn[standard]" \
  google-adk google-genai mcp supabase \
  pydantic pydantic-settings httpx \
  sse-starlette python-multipart apscheduler \
  openai pynacl slowapi pyjwt

COPY src/ ./src/

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
