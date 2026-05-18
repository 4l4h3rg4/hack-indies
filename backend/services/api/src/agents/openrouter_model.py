"""
OpenRouter model adapter for Google ADK.

Thin wrapper (~80 lines) that translates between ADK's Google GenAI types
and OpenAI-compatible chat completions via OpenRouter.

Zero dependencies beyond the `openai` SDK already used for embeddings.
No litellm, no google-adk[extensions], no supply-chain risk.
"""

import json
import logging

from google.adk.models.base_llm import BaseLlm
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.genai import types as genai_types
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

# Map Google GenAI roles to OpenAI roles
_ROLE_MAP = {
    "user": "user",
    "model": "assistant",
    "assistant": "assistant",
    "system": "system",
}


def _normalize_schema(schema: dict) -> dict:
    """Ensure schema is OpenAI-compatible.

    Google GenAI's Schema type has two incompatibilities with OpenAI:
    1. May omit `type: "object"` even when properties are present.
    2. Uses uppercase type values (STRING, NUMBER, OBJECT) while OpenAI
       requires lowercase (string, number, object).

    Both cases cause 400 errors from OpenRouter when forwarding to Google:
    'For schema with properties, schema type should be OBJECT.'
    """
    if not isinstance(schema, dict):
        return schema

    result = dict(schema)

    # Fix type casing: Google uses STRING/OBJECT/etc, OpenAI requires lowercase
    if "type" in result and isinstance(result["type"], str):
        result["type"] = result["type"].lower()

    # Any schema with properties must have type: object
    if result.get("properties") and result.get("type") != "object":
        result["type"] = "object"

    for key, value in result.items():
        if key == "properties" and isinstance(value, dict):
            result[key] = {k: _normalize_schema(v) if isinstance(v, dict) else v for k, v in value.items()}
        elif isinstance(value, dict):
            result[key] = _normalize_schema(value)
        elif isinstance(value, list):
            result[key] = [_normalize_schema(item) if isinstance(item, dict) else item for item in value]

    return result


def _parse_tool_args(args):
    """Parse tool call arguments from OpenAI format to ADK dict.

    OpenAI returns `function.arguments` as a JSON string, but ADK's
    `FunctionCall.args` expects a dict. Handle both formats safely.
    """
    if isinstance(args, dict):
        return args
    if isinstance(args, str) and args.strip():
        try:
            parsed = json.loads(args)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {}


def _content_to_openai_message(part: genai_types.Content) -> dict:
    """Convert a single GenAI Content to an OpenAI message dict."""
    role = _ROLE_MAP.get(part.role, "user")
    content_texts = []
    tool_calls = []

    for p in part.parts or []:
        if p.text is not None:
            content_texts.append(p.text)
        elif hasattr(p, "function_call") and p.function_call is not None:
            fc = p.function_call
            # OpenAI/Mistral requiere arguments como JSON string, no dict
            raw_args = fc.args or {}
            arguments = json.dumps(raw_args) if isinstance(raw_args, dict) else (raw_args or "{}")
            tool_calls.append({
                "id": getattr(fc, "id", "") or "",
                "type": "function",
                "function": {
                    "name": fc.name or "",
                    "arguments": arguments,
                },
            })
        elif hasattr(p, "function_response") and p.function_response is not None:
            fr = p.function_response
            return {
                "role": "tool",
                "tool_call_id": getattr(fr, "id", "") or fr.name or "",
                "content": fr.response if isinstance(fr.response, str) else str(fr.response or ""),
            }

    if tool_calls:
        return {"role": role, "content": "\n".join(content_texts) or None, "tool_calls": tool_calls}
    return {"role": role, "content": "\n".join(content_texts)}


class OpenRouterModel(BaseLlm):
    """OpenAI-compatible model adapter for ADK, pointed at OpenRouter."""

    def __init__(self, model: str, api_key: str, base_url: str = "https://openrouter.ai/api/v1", **kwargs):
        super().__init__(model=model)
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self._extra_config = kwargs

    async def generate_content_async(
        self, llm_request: LlmRequest, stream: bool = False
    ):
        """Generate content via OpenRouter. Returns as async generator (ADK 1.33 expects this)."""
        cfg = llm_request.config or genai_types.GenerateContentConfig()

        messages = []

        # System instruction: ADK stores agent instruction in cfg.system_instruction
        # It may be a plain string OR a Content object (role="system", parts=[text])
        system_prompt = None
        si = getattr(cfg, "system_instruction", None)
        if si:
            if isinstance(si, str):
                system_prompt = si
            elif hasattr(si, "parts"):
                texts = [p.text for p in si.parts if hasattr(p, "text") and p.text]
                system_prompt = "\n".join(texts) if texts else None

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Convert conversation contents
        for c in llm_request.contents or []:
            messages.append(_content_to_openai_message(c))

        params = {
            "model": self.model,
            "messages": messages,
            "temperature": getattr(cfg, "temperature", None) or 0.7,
            "max_tokens": getattr(cfg, "max_output_tokens", None) or 16384,
            "parallel_tool_calls": True,
        }

        # Extract tool/function declarations from ADK config
        tools = self._extract_tools(cfg)
        if tools:
            params["tools"] = tools

        # Extra HTTP headers for OpenRouter
        params["extra_headers"] = {
            "HTTP-Referer": "https://hackindie.dev",
            "X-Title": "HackIndie CISO",
        }

        try:
            logger.info("OpenRouter request: model=%s, msgs=%d, tools=%d, sys=%s",
                        self.model, len(messages),
                        len(params.get("tools") or []),
                        "yes" if system_prompt else "no")
            completion = await self._client.chat.completions.create(**params)
            choice = completion.choices[0]
            message = choice.message
            logger.info("OpenRouter response: content_len=%d, tool_calls=%d, finish=%s",
                        len(message.content or ""),
                        len(message.tool_calls or []),
                        choice.finish_reason)

            parts = []
            if message.content:
                parts.append(genai_types.Part.from_text(text=message.content))

            # Tool calls → ADK function_call parts
            if message.tool_calls:
                for tc in message.tool_calls:
                    fc = genai_types.FunctionCall(
                        id=tc.id,
                        name=tc.function.name,
                        args=_parse_tool_args(tc.function.arguments),
                    )
                    parts.append(genai_types.Part(function_call=fc))

            yield LlmResponse(
                content=genai_types.Content(role="model", parts=parts),
            )

        except Exception as e:
            logger.error(f"OpenRouter API call failed: {e}")
            yield LlmResponse(
                content=genai_types.Content(
                    role="model",
                    parts=[genai_types.Part.from_text(text=f"Error: {e}")],
                ),
                error_code="api_error",
                error_message=str(e),
            )

    @staticmethod
    def _extract_tools(cfg) -> list[dict] | None:
        """Extract function declarations from ADK config and convert to OpenAI tool format."""
        openai_tools = []
        seen_names: set[str] = set()

        cfg_tools = getattr(cfg, "tools", None) or []
        for tool in cfg_tools:
            declarations = None

            if hasattr(tool, "function_declarations") and tool.function_declarations:
                declarations = tool.function_declarations
            elif hasattr(tool, "_function_declarations") and tool._function_declarations:
                declarations = tool._function_declarations
            elif hasattr(tool, "_get_declaration"):
                decl = tool._get_declaration()
                if decl:
                    declarations = [decl]

            if not declarations:
                continue

            for fd in declarations:
                name = getattr(fd, "name", "") or ""

                if not name or name in seen_names:
                    if name in seen_names:
                        logger.debug("Skipping duplicate tool: %s", name)
                    continue
                seen_names.add(name)

                description = getattr(fd, "description", "") or ""

                params = getattr(fd, "parameters", None) or {}
                if hasattr(params, "model_dump"):
                    params = params.model_dump(exclude_none=True)
                elif not isinstance(params, dict):
                    params = {}

                if isinstance(params, dict):
                    params = _normalize_schema(params)

                openai_tools.append({
                    "type": "function",
                    "function": {
                        "name": name,
                        "description": description,
                        "parameters": params if isinstance(params, dict) else {},
                    },
                })

        if openai_tools:
            logger.info("OpenRouter tools extracted: %d", len(openai_tools))
        return openai_tools if openai_tools else None
