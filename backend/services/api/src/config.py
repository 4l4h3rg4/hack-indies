from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    app_env: str = "development"
    app_debug: bool = True
    cors_origins: str = "http://localhost:3000"

    # ── OpenRouter (unified API) ──
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"

    # ── Legacy keys (fallback) ──
    google_api_key: str = ""
    openai_api_key: str = ""

    # ── Supabase ──
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    # ── Models ──
    llm_model: str = "openrouter/google/gemini-2.5-flash"
    llm_temperature: float = 0.2
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # ── Watcher ──
    watcher_interval_minutes: int = 60
    nvd_api_url: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    @property
    def using_openrouter(self) -> bool:
        return bool(self.openrouter_api_key)

    @property
    def openrouter_model(self) -> str:
        """Returns the OpenRouter model name (e.g. 'google/gemini-2.5-flash')."""
        if self.llm_model.startswith("openrouter/"):
            return self.llm_model.replace("openrouter/", "", 1)
        # If user sets a plain model, assume OpenRouter prefix
        return self.llm_model

    @property
    def effective_embedding_model(self) -> str:
        if self.using_openrouter:
            return f"openai/{self.embedding_model}"
        return self.embedding_model


settings = Settings()
