from unittest.mock import patch

from src.agents.model_factory import build_model


class TestModelFactory:
    def test_fallback_gemini_model(self):
        with patch("src.agents.model_factory.settings") as mock:
            mock.using_openrouter = False
            mock.llm_model = "gemini-flash-latest"
            mock.llm_temperature = 0.5

            result = build_model()
            assert result == "gemini-flash-latest"

    def test_fallback_gemini_with_custom_temperature(self):
        with patch("src.agents.model_factory.settings") as mock:
            mock.using_openrouter = False
            mock.llm_model = "gemini-pro"
            mock.llm_temperature = 0.5

            result = build_model(temperature=0.1)
            assert result == "gemini-pro"

    def test_openrouter_model_creation(self):
        with patch("src.agents.model_factory.settings") as mock:
            mock.using_openrouter = True
            mock.openrouter_model = "google/gemini-2.5-flash"
            mock.openrouter_api_key = "test-api-key"
            mock.openrouter_base_url = "https://openrouter.ai/api/v1"
            mock.llm_temperature = 0.3

            with patch("src.agents.openrouter_model.OpenRouterModel") as mock_model:
                result = build_model()
                mock_model.assert_called_once_with(
                    model="google/gemini-2.5-flash",
                    api_key="test-api-key",
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.3,
                )
                assert result == mock_model.return_value

    def test_openrouter_with_custom_temperature(self):
        with patch("src.agents.model_factory.settings") as mock:
            mock.using_openrouter = True
            mock.openrouter_model = "google/gemini-2.5-flash"
            mock.openrouter_api_key = "test-key"
            mock.openrouter_base_url = "https://openrouter.ai/api/v1"
            mock.llm_temperature = 0.5

            with patch("src.agents.openrouter_model.OpenRouterModel") as mock_model:
                result = build_model(temperature=0.1)
                mock_model.assert_called_once_with(
                    model="google/gemini-2.5-flash",
                    api_key="test-key",
                    base_url="https://openrouter.ai/api/v1",
                    temperature=0.1,
                )
                assert result == mock_model.return_value
