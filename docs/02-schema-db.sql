-- ============================================================
-- HackIndie CISO Virtual — Schema de Base de Datos
-- Versión: 2.0 (production-ready)
-- Para ejecutar en Supabase Cloud SQL Editor
-- ============================================================
-- Requiere extensiones:
--   1. vector (pgvector — habilitar desde dashboard)
-- ============================================================

-- ============================================================
-- 0. Habilitar extensiones
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- 1. Tabla de perfiles de usuario
-- ============================================================
-- PK UUID: obligatorio porque referencia auth.users.id
-- (Supabase Cloud no incluye pg_uuidv7, usa gen_random_uuid)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'profiles' AND schemaname = 'public') THEN
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
  END IF;
END $$;

-- Email único (DO block porque ADD CONSTRAINT IF NOT EXISTS no existe en PG)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_email_unique'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_unique UNIQUE (email);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_risk_level ON profiles(risk_level);

-- ============================================================
-- 2. Conexiones de infraestructura del usuario
-- ============================================================
-- PK bigint identity: mejor performance, sin fragmentación (single DB)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'connections' AND schemaname = 'public') THEN
    CREATE TABLE public.connections (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      service_type TEXT NOT NULL,
      service_name TEXT NOT NULL,
      connection_config JSONB NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'disconnected'
        CHECK (status IN ('connected', 'disconnected', 'error', 'requires_attention')),
      last_checked TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_user_type ON connections(user_id, service_type);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

-- ============================================================
-- 3. Apuntes mentales (RAG)
-- ============================================================
-- PK bigint identity: inserciones frecuentes, evita fragmentación

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'mental_notes' AND schemaname = 'public') THEN
    CREATE TABLE public.mental_notes (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      content TEXT NOT NULL,
      embedding extensions.vector(1536),
      source_session_id TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- B-tree: filtro por usuario (usado en match_mental_notes)
CREATE INDEX IF NOT EXISTS idx_mental_notes_user ON mental_notes(user_id);

-- B-tree compuesto: queries por usuario + orden temporal
-- usado para "mis apuntes más recientes"
CREATE INDEX IF NOT EXISTS idx_mental_notes_user_created ON mental_notes(user_id, created_at DESC);

-- B-tree: búsqueda por sesión de origen
CREATE INDEX IF NOT EXISTS idx_mental_notes_session ON mental_notes(source_session_id);

-- HNSW: búsqueda semántica global (útil cuando no se filtra por user_id,
-- o para queries cross-user del Watcher). No se combina con el filtro de
-- user_id; Postgres elige el índice B-tree porque filtra a ~100 filas/usuario.
CREATE INDEX IF NOT EXISTS idx_mental_notes_embedding
  ON mental_notes
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ============================================================
-- 4. Sesiones de chat
-- ============================================================
-- PK bigint identity

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'chat_sessions' AND schemaname = 'public') THEN
    CREATE TABLE public.chat_sessions (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      title TEXT,
      adk_session_id TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'summarized')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_status ON chat_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);

-- ============================================================
-- 5. Alertas de seguridad
-- ============================================================
-- PK bigint identity

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'alerts' AND schemaname = 'public') THEN
    CREATE TABLE public.alerts (
      id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
      source_agent TEXT NOT NULL,
      connection_id BIGINT REFERENCES public.connections ON DELETE SET NULL,
      status TEXT DEFAULT 'open'
        CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
      resolution_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  END IF;
END $$;

-- FK: siempre indexar columnas foreign key (schema-foreign-key-indexes)
CREATE INDEX IF NOT EXISTS idx_alerts_connection ON alerts(connection_id);

-- Compuesto: dashboard (WHERE user_id = X AND status = 'open')
CREATE INDEX IF NOT EXISTS idx_alerts_user_status ON alerts(user_id, status);

-- Compuesto: cálculo de riesgo (WHERE user_id = X AND severity = 'critical')
CREATE INDEX IF NOT EXISTS idx_alerts_user_severity ON alerts(user_id, severity);

-- Compuesto: orden cronológico por usuario
CREATE INDEX IF NOT EXISTS idx_alerts_user_created ON alerts(user_id, created_at DESC);

-- Índices simples para queries de Watcher (cross-user)
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_source_agent ON alerts(source_agent);

-- ============================================================
-- RLS Policies (idempotent)
-- ============================================================

DO $$
BEGIN
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.mental_notes ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Políticas (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owner_access' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "owner_access" ON public.profiles
      FOR ALL TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owner_access' AND tablename = 'connections'
  ) THEN
    CREATE POLICY "owner_access" ON public.connections
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owner_access' AND tablename = 'mental_notes'
  ) THEN
    CREATE POLICY "owner_access" ON public.mental_notes
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owner_access' AND tablename = 'chat_sessions'
  ) THEN
    CREATE POLICY "owner_access" ON public.chat_sessions
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'owner_access' AND tablename = 'alerts'
  ) THEN
    CREATE POLICY "owner_access" ON public.alerts
      FOR ALL TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Funciones SQL
-- ============================================================

-- Búsqueda semántica de apuntes mentales por coseno
-- match_user_id acepta TEXT (viene del backend como string) pero se castea a UUID
-- El planificador usa idx_mental_notes_user (B-tree) porque el filtro por
-- usuario reduce el set a ~100-1000 filas, y luego calcula distancia exacta.
-- El índice HNSW no se usa para esta query per-user por diseño (ver nota arriba).
CREATE OR REPLACE FUNCTION match_mental_notes(
  query_embedding extensions.vector(1536),
  match_user_id TEXT,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id BIGINT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
BEGIN
  IF match_user_id IS NULL OR match_user_id = '' THEN
    RAISE EXCEPTION 'match_user_id is required' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
  SELECT
    mn.id,
    mn.content,
    mn.metadata,
    1 - (mn.embedding <=> query_embedding) AS similarity,
    mn.created_at
  FROM mental_notes mn
  WHERE mn.user_id = match_user_id::uuid
  ORDER BY mn.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Trigger: crear perfil automáticamente al registrarse en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger idempotent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_user();
  END IF;
END $$;

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_timestamp'
  ) THEN
    CREATE TRIGGER update_profiles_timestamp
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_timestamp();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_chat_sessions_timestamp'
  ) THEN
    CREATE TRIGGER update_chat_sessions_timestamp
      BEFORE UPDATE ON public.chat_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.update_timestamp();
  END IF;
END $$;

-- ============================================================
-- Publicación para Supabase Realtime (idempotent)
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'alerts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'connections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'chat_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_sessions;
  END IF;
END $$;

-- ============================================================
-- Producción: Notas adicionales
-- ============================================================
--
-- 1. Connection pooling:
--    Supabase Cloud incluye PgBouncer en modo transaction pool.
--    Para el backend Python, usar el puerto 6543 (pooler) en vez de 5432
--    para conexiones serverless/stateless. Configurar pool_size ~20.
--
-- 2. Índices HNSW:
--    m=16, ef_construction=200 son valores conservadores.
--    Para >1M vectores, aumentar ef_construction a 300-500.
--    Para queries, ajustar ef_search con SET hnsw.ef_search = 100;
--
-- 3. Estrategia de PKs:
--    profiles: UUID (requerido por auth.users)
--    resto de tablas: BIGINT GENERATED ALWAYS AS IDENTITY (SQL-standard,
--    sin fragmentación, más rápido que UUID en single-DB).
--    pg_uuidv7 no está disponible en Supabase Cloud aún (Mayo 2026).
--
-- 4. VACUUM / mantenimiento:
--    Configurar autovacuum más agresivo en mental_notes (muchas inserciones).
--    ALTER TABLE mental_notes SET (autovacuum_vacuum_scale_factor = 0.05);
--
-- ============================================================
-- Seed de datos de prueba
-- ============================================================

-- INSERT INTO public.connections
--   (user_id, service_type, service_name, connection_config, status)
-- VALUES
--   ('UUID-DEL-USUARIO', 'supabase', 'Mi Supabase',
--    '{"url": "https://xxx.supabase.co", "encrypted_credentials": "..."}',
--    'connected');

-- INSERT INTO public.alerts
--   (user_id, title, description, severity, source_agent)
-- VALUES
--   ('UUID-DEL-USUARIO', 'Tablas sin RLS detectadas',
--    'Se encontraron 3 tablas sin políticas Row Level Security', 'high', 'inspector'),
--   ('UUID-DEL-USUARIO', 'API key expuesta en frontend',
--    'Se detectó una API key en el código fuente público del frontend', 'critical', 'inspector');
