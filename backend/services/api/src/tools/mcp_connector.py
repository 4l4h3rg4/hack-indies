import logging
from typing import Optional

from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import (
    StdioConnectionParams,
    StreamableHTTPConnectionParams,
)
from mcp import StdioServerParameters

logger = logging.getLogger(__name__)


# Todos los servidores stdio están pre-instalados globalmente en el contenedor.
# NO usar "npx -y" para los pre-instalados — evita descargar versiones distintas.
MCP_SERVER_CONFIGS = {
    "supabase": {
        "type": "stdio",
        "command": "npx",
        "args": ["@supabase/mcp-server-supabase"],
        "env_template": {
            "SUPABASE_ACCESS_TOKEN": "{access_token}",
            "SUPABASE_PROJECT_REF": "{project_ref}",
        },
    },
    # Pinneado a 0.6.2 — la versión 2025.4.8 está deprecada y rota (BrokenResourceError)
    "github": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-github@0.6.2"],
        "env_template": {
            "GITHUB_PERSONAL_ACCESS_TOKEN": "{personal_access_token}",
        },
    },
    "postgresql": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-postgres"],
        "env_template": {
            "DATABASE_URL": "{connection_string}",
        },
    },
    "sentry": {
        "type": "stdio",
        "command": "npx",
        "args": ["@sentry/mcp-server", "--transport", "stdio"],
        "env_template": {
            "SENTRY_AUTH_TOKEN": "{auth_token}",
        },
    },
    "filesystem": {
        "type": "stdio",
        "command": "npx",
        "args": ["@modelcontextprotocol/server-filesystem", "/tmp"],
        "env_template": {},
    },
    # Servidor MCP propio para Vercel — corre localmente, tokens no salen del contenedor
    "vercel": {
        "type": "stdio",
        "command": "node",
        "args": ["/app/mcp-servers/vercel-mcp.mjs"],
        "env_template": {
            "VERCEL_TOKEN": "{access_token}",
        },
    },
    "generic_mcp": {
        "type": "streamable_http",
        "url_template": "{url}",
        "headers_template": {},
    },
}


def build_mcp_toolset(
    service_type: str,
    config: dict,
    tool_filter: Optional[list[str]] = None,
) -> McpToolset | None:
    server_config = MCP_SERVER_CONFIGS.get(service_type)
    if not server_config:
        logger.error(f"No MCP config for service type: {service_type}")
        return None

    try:
        if server_config["type"] == "stdio":
            env = {}
            for key, template in server_config.get("env_template", {}).items():
                try:
                    env[key] = template.format(**config)
                except KeyError:
                    pass  # credencial opcional no provista

            connection_params = StdioConnectionParams(
                server_params=StdioServerParameters(
                    command=server_config["command"],
                    args=server_config.get("args", []),
                    env=env if env else None,
                )
            )
        elif server_config["type"] == "streamable_http":
            url = server_config["url_template"].format(**config)
            headers = {}
            for key, template in server_config.get("headers_template", {}).items():
                headers[key] = template.format(**config)

            connection_params = StreamableHTTPConnectionParams(
                url=url,
                headers=headers if headers else None,
            )
        else:
            logger.error(f"Unknown MCP transport type: {server_config['type']}")
            return None

        return McpToolset(
            connection_params=connection_params,
            tool_filter=tool_filter,
        )

    except Exception as e:
        logger.error(f"Failed to build MCP toolset for {service_type}: {e}")
        return None


async def list_mcp_tools(service_type: str, config: dict) -> list[str]:
    toolset = build_mcp_toolset(service_type, config)
    if not toolset:
        return []

    try:
        tools = await toolset.get_tools()
        return [tool.name for tool in tools]
    except Exception as e:
        logger.error(f"Failed to list MCP tools for {service_type}: {e}")
        return []
