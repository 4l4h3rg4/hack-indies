-- ============================================================
-- HackIndie CISO Virtual — Schema de Base de Datos
-- ============================================================
-- Para ejecutar en Supabase Cloud SQL Editor
-- Requiere: extensión pgvector habilitada
-- ============================================================

-- 1. Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company_name TEXT,
  risk_level TEXT DEFAULT 'unknown'
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical', 'unknown')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Conexiones de infraestructura del usuario
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  service_name TEXT NOT NULL,
  connection_config JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'error', 'requires_attention')),
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connections_user ON connections(user_id);

-- 4. Apuntes mentales (RAG)
CREATE TABLE public.mental_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  source_session_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mental_notes_user ON mental_notes(user_id);
CREATE INDEX idx_mental_notes_embedding
  ON mental_notes
  USING hnsw (embedding vector_cosine_ops);

-- 5. Sesiones de chat
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT,
  adk_session_id TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'summarized')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

-- 6. Alertas de seguridad
CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  source_agent TEXT NOT NULL,
  connection_id UUID REFERENCES public.connections ON DELETE SET NULL,
  status TEXT DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mental_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Política: cada usuario solo ve sus propios datos
CREATE POLICY "owner_access" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "owner_access" ON public.connections
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_access" ON public.mental_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_access" ON public.chat_sessions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "owner_access" ON public.alerts
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Funciones SQL
-- ============================================================

-- Búsqueda semántica de apuntes mentales
CREATE OR REPLACE FUNCTION match_mental_notes(
  query_embedding extensions.vector(1536),
  match_user_id TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mn.id,
    mn.content,
    mn.metadata,
    1 - (mn.embedding <=> query_embedding) AS similarity,
    mn.created_at
  FROM mental_notes mn
  WHERE mn.user_id = match_user_id
  ORDER BY mn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_timestamp
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER update_chat_sessions_timestamp
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- ============================================================
-- Publicación para Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;

-- ============================================================
-- Datos de ejemplo (seed)
-- ============================================================

-- NOTA: Ejecutar solo después de tener usuarios creados vía auth

-- INSERT INTO public.connections (user_id, service_type, service_name, connection_config, status)
-- VALUES
--   ('USER-UUID-HERE', 'supabase', 'Mi Supabase', '{"url": "https://...", "encrypted_credentials": "..."}', 'connected'),
--   ('USER-UUID-HERE', 'shopify', 'Tienda Online', '{"store_url": "...", "encrypted_credentials": "..."}', 'connected');

-- INSERT INTO public.alerts (user_id, title, description, severity, source_agent)
-- VALUES
--   ('USER-UUID-HERE', 'Tablas sin RLS detectadas', 'Se encontraron 3 tablas sin políticas Row Level Security', 'high', 'inspector'),
--   ('USER-UUID-HERE', 'API key expuesta', 'Se detectó una API key en el código fuente público', 'critical', 'inspector');
