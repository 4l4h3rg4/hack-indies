from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    app_env: str = "development"
    app_debug: bool = True
    cors_origins: str = "http://localhost:3000"

    google_api_key: str = ""
    openai_api_key: str = ""

    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""

    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    watcher_interval_minutes: int = 60
    nvd_api_url: str = "https://services.nvd.nist.gov/rest/json/cves/2.0"

    llm_model: str = "gemini-2.5-flash"
    llm_temperature: float = 0.2


settings = Settings()
