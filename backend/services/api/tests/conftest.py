import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

mock_supabase = MagicMock()
sys.modules["supabase"] = mock_supabase


@pytest.fixture(autouse=True)
def _mock_dependencies():
    with (
        patch("src.config.settings") as mock_settings,
        patch("src.memory.embedder.AsyncOpenAI", MagicMock()),
    ):
        mock_settings.using_openrouter = False
        mock_settings.llm_model = "gemini-2.5-flash"
        mock_settings.llm_temperature = 0.2
        mock_settings.google_api_key = "test-key"
        mock_settings.openai_api_key = "test-key"
        mock_settings.openrouter_api_key = ""
        mock_settings.openrouter_base_url = "https://openrouter.ai/api/v1"
        mock_settings.supabase_url = ""
        mock_settings.supabase_service_key = ""
        mock_settings.supabase_jwt_secret = "test-secret"
        mock_settings.app_debug = True
        yield mock_settings


@pytest.fixture
def mock_callback_context():
    ctx = MagicMock()
    ctx.state = {}
    return ctx
