from unittest.mock import MagicMock

import pytest

from src.agents.inspector import _log_tool_usage, _read_only_gate, build_inspector
from src.agents.operator import (
    _approval_gate,
    _log_operator_tool,
    _request_approval,
    build_operator,
)
from src.agents.orchestrator import _init_orchestrator_state, build_orchestrator


class TestOrquestador:
    def test_build_without_sub_agents(self):
        agent = build_orchestrator()
        assert agent.name == "Orquestador"
        assert agent.sub_agents == []
        assert len(agent.tools) == 3
        assert agent.before_agent_callback is not None
        assert agent.output_key is None

    def test_build_with_sub_agents(self):
        inspector = build_inspector()
        operator = build_operator()

        agent = build_orchestrator(inspector_agent=inspector, operator_agent=operator)
        assert len(agent.sub_agents) == 2
        assert agent.sub_agents[0].name == "Inspector"
        assert agent.sub_agents[1].name == "Operador"

    def test_init_state_callback(self, mock_callback_context):
        mock_callback_context.state = {}
        import asyncio

        asyncio.run(_init_orchestrator_state(mock_callback_context))
        assert mock_callback_context.state["invocation_count"] == 1

        asyncio.run(_init_orchestrator_state(mock_callback_context))
        assert mock_callback_context.state["invocation_count"] == 2

    def test_instruction_mentions_audit_result(self):
        agent = build_orchestrator()
        assert "audit_result" in agent.instruction


class TestInspector:
    def test_build_basic(self):
        agent = build_inspector()
        assert agent.name == "Inspector"
        assert agent.tools == []
        assert agent.before_tool_callback is not None
        assert agent.after_tool_callback is not None
        assert agent.output_key == "audit_result"

    def test_build_with_mcp_tools(self):
        toolsets = [MagicMock()]
        agent = build_inspector(mcp_toolsets=toolsets)
        assert len(agent.tools) == 1

    @pytest.mark.parametrize("tool_name,should_block", [
        ("apply_migration", True),
        ("execute_sql", True),
        ("deploy_edge_function", True),
        ("create_table", True),
        ("update_record", True),
        ("delete_row", True),
        ("insert_data", True),
        ("drop_table", True),
        ("alter_table", True),
        ("grant_access", True),
        ("revoke_token", True),
        ("truncate_logs", True),
        ("generate_key", True),
        ("write_file", True),
        ("set_config", True),
        ("modify_policy", True),
        ("upsert_record", True),
    ])
    async def test_read_only_gate_blocks_write_tools(self, tool_name, should_block):
        result = await _read_only_gate(MagicMock(), tool_name, {})
        if should_block:
            assert result is not None
            assert result["status"] == "blocked"
        else:
            assert result is None

    @pytest.mark.parametrize("tool_name,should_block", [
        ("list_tables", False),
        ("get_logs", False),
        ("search_docs", False),
        ("read_file", False),
        ("describe_table", False),
        ("fetch_data", False),
        ("query_records", False),
        ("show_indexes", False),
        ("find_user", False),
        ("check_status", False),
        ("view_policy", False),
    ])
    async def test_read_only_gate_allows_read_tools(self, tool_name, should_block):
        result = await _read_only_gate(MagicMock(), tool_name, {})
        assert result is None

    async def test_log_tool_usage_success(self, mock_callback_context):
        result = await _log_tool_usage(mock_callback_context, "list_tables", {"tables": []})
        assert result is None

    async def test_log_tool_usage_blocked(self, mock_callback_context):
        result = await _log_tool_usage(
            mock_callback_context, "execute_sql", {"status": "blocked", "error": "denied"}
        )
        assert result is None


class TestOperador:
    def test_build_basic(self):
        agent = build_operator()
        assert agent.name == "Operador"
        assert len(agent.tools) == 1
        assert agent.before_tool_callback is not None
        assert agent.after_tool_callback is not None

    def test_build_with_mcp_tools(self):
        toolsets = [MagicMock()]
        agent = build_operator(mcp_toolsets=toolsets)
        assert len(agent.tools) == 2

    def test_request_approval_stores_pending(self, mock_callback_context):
        mock_callback_context.state = {}
        result = _request_approval(
            "update_rls_policy",
            "Activar RLS en tabla users",
            mock_callback_context,
        )
        assert result["status"] == "pending_approval"
        assert result["action_name"] == "update_rls_policy"
        assert "action_id" in result
        pending = mock_callback_context.state["pending_approval"]
        assert result["action_id"] in pending
        assert not pending[result["action_id"]]["approved"]

    async def test_approval_gate_allows_request_approval(self):
        ctx = MagicMock()
        ctx.state = {}
        result = await _approval_gate(ctx, "request_approval", {})
        assert result is None

    async def test_approval_gate_blocks_unapproved_tools(self):
        ctx = MagicMock()
        ctx.state = {"approved_action_id": "", "pending_approval": {}}
        result = await _approval_gate(ctx, "apply_migration", {"sql": "DROP TABLE"})
        assert result is not None
        assert result["status"] == "blocked"

    async def test_approval_gate_allows_approved_action(self):
        action_id = "test-action-id"
        ctx = MagicMock()
        ctx.state = {
            "approved_action_id": action_id,
            "pending_approval": {
                action_id: {"action_name": "apply_migration", "approved": False}
            },
        }
        result = await _approval_gate(ctx, "apply_migration", {"sql": "SELECT 1"})
        assert result is None
        assert ctx.state["pending_approval"][action_id]["approved"]
        assert ctx.state["approved_action_id"] == ""

    async def test_approval_gate_allows_previously_approved(self):
        ctx = MagicMock()
        ctx.state = {
            "approved_action_id": "",
            "pending_approval": {
                "old-id": {"action_name": "update_rls", "approved": True}
            },
        }
        result = await _approval_gate(ctx, "update_rls", {})
        assert result is None

    async def test_log_operator_tool(self, mock_callback_context):
        result = await _log_operator_tool(
            mock_callback_context, "apply_migration", {"status": "ok"}
        )
        assert result is None


class TestMCPToolsetIntegration:
    def test_toolset_is_mocked_in_agent_build(self):
        fake_toolset = MagicMock()
        agent = build_inspector(mcp_toolsets=[fake_toolset])
        assert fake_toolset in agent.tools

        agent = build_operator(mcp_toolsets=[fake_toolset])
        assert fake_toolset in agent.tools
