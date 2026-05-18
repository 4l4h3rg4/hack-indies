FROM python:3.12-slim

WORKDIR /app

# Install Node.js 20 for MCP stdio connectors
RUN apt-get update && apt-get install -y curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Pre-install MCP packages globalmente.
# NOTAS:
#   - github: pinneado a 0.6.2 — 2025.4.8 está deprecada y rota (BrokenResourceError)
#   - shopify: shopify-mcp-server (no @shopify/mcp-server-shopify — no existe en npm)
#   - sentry: @sentry/mcp-server (oficial de Sentry, no @modelcontextprotocol/server-sentry)
RUN npm install -g \
    @supabase/mcp-server-supabase \
    @modelcontextprotocol/server-filesystem \
    @modelcontextprotocol/server-github@0.6.2 \
    @modelcontextprotocol/server-postgres \
    @sentry/mcp-server

# Custom Vercel MCP server (local — tokens no salen del contenedor)
COPY mcp-servers/ ./mcp-servers/
RUN cd /app/mcp-servers && npm install --production

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

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
