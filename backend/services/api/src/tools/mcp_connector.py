import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Optional

from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StdioConnectionParams, StreamableHTTPConnectionParams
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamablehttp_client

logger = logging.getLogger(__name__)

MCP_SERVER_CONFIGS = {
    "supabase": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@supabase/mcp-server-supabase"],
        "env_template": {
            "SUPABASE_URL": "{url}",
            "SUPABASE_SERVICE_KEY": "{service_key}",
        },
    },
    "shopify": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@shopify/mcp-server-shopify"],
        "env_template": {
            "SHOPIFY_ACCESS_TOKEN": "{access_token}",
            "SHOPIFY_STORE_URL": "{store_url}",
        },
    },
    "filesystem": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
        "env_template": {},
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
                env[key] = template.format(**config)

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
        logger.error(f"Failed to build MCP toolset: {e}")
        return None


async def list_mcp_tools(service_type: str, config: dict) -> list[str]:
    toolset = build_mcp_toolset(service_type, config)
    if not toolset:
        return []

    try:
        tools = await toolset.get_tools()
        return [tool.name for tool in tools]
    except Exception as e:
        logger.error(f"Failed to list MCP tools: {e}")
        return []
