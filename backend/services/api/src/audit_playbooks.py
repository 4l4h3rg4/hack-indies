"""Audit playbooks per service type.

Cada playbook es un checklist EJECUTABLE paso a paso, escrito para forzar al
LLM (especialmente modelos rápidos como Gemini Flash) a emitir tool_calls
reales en lugar de solo describir lo que haría.

Los playbooks asumen los tools típicos de cada servidor MCP de referencia
(@modelcontextprotocol/server-*, @supabase/mcp-server-supabase, etc.).
Si el agente descubre que un tool no existe, debe usar el más cercano disponible.
"""


GITHUB = """
═══ AUDITORÍA GITHUB — Ejecutá EXACTAMENTE estos pasos, EMITIENDO el tool_call en cada uno ═══

PASO 1: EMITE tool_call search_repositories({"query": "user:@me"}) para listar TODOS los repos del usuario.
   → No describas que vas a hacerlo. HACELO AHORA.

PASO 2: Para CADA repositorio devuelto, EJECUTÁ en orden:
   2a. get_file_contents({"owner": <owner>, "repo": <repo>, "path": "package.json"}) — si responde 404, ignorá.
   2b. get_file_contents({"owner": <owner>, "repo": <repo>, "path": "requirements.txt"}) — si responde 404, ignorá.
   2c. get_file_contents({"owner": <owner>, "repo": <repo>, "path": ".env"}) — si EXISTE, eso es CRÍTICO (credenciales en repo).
   2d. get_file_contents({"owner": <owner>, "repo": <repo>, "path": ".env.example"}) — verificá que no tenga secrets reales.

PASO 3: Buscá secrets hardcodeados en TODO el código del usuario:
   3a. search_code({"q": "ghp_ user:@me"}) — GitHub PATs expuestos.
   3b. search_code({"q": "sk_live user:@me"}) — Stripe live keys.
   3c. search_code({"q": "sbp_ user:@me"}) — Supabase PATs.
   3d. search_code({"q": "AKIA user:@me"}) — AWS access keys.
   3e. search_code({"q": "AIzaSy user:@me"}) — Google API keys.

PASO 4: Para cada repo, EJECUTÁ list_pull_requests({"owner": <owner>, "repo": <repo>, "state": "open"}) y revisá títulos sospechosos.

PASO 5: list_issues({"owner": <owner>, "repo": <repo>, "labels": "security"}) — issues de seguridad sin resolver.

REPORTÁ EN ESTE FORMATO (uno por hallazgo):
  • SEVERIDAD: [Crítico|Alto|Medio|Bajo]
  • REPOSITORIO: <owner>/<repo>
  • HALLAZGO: <descripción específica>
  • EVIDENCIA: <archivo:línea o link al snippet>
  • REMEDIACIÓN: <pasos concretos para arreglar>

CRITERIOS DE SEVERIDAD:
  • Crítico: secrets en repo público, dependencias con CVE >= 9.0, RCE, .env commiteado.
  • Alto: dependencias con CVE 7-8.9, falta MFA en colaboradores, branch main sin protección.
  • Medio: dependencias outdated >12 meses, Dockerfile con USER root.
  • Bajo: falta de README, falta de LICENSE, archivos .DS_Store commiteados.
"""


SUPABASE = """
═══ AUDITORÍA SUPABASE — Ejecutá EXACTAMENTE estos pasos, EMITIENDO el tool_call ═══

PASO 1: EMITE tool_call list_projects() para enumerar proyectos.
PASO 2: Para el proyecto activo, EJECUTÁ list_tables({"schemas": ["public"]}) para todas las tablas.

PASO 3: Por CADA tabla, EJECUTÁ execute_sql con esta query para verificar RLS:
   {"query": "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename='<tabla>'"}
   → Si rowsecurity = false → CRÍTICO (acceso público a la tabla).

PASO 4: EJECUTÁ execute_sql para listar todas las policies:
   {"query": "SELECT schemaname, tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname='public'"}
   → Si alguna policy tiene qual = 'true' → CRÍTICO (policy permite todo).

PASO 5: EJECUTÁ execute_sql para detectar funciones con SECURITY DEFINER:
   {"query": "SELECT proname, prosrc FROM pg_proc WHERE prosecdef = true AND pronamespace = 'public'::regnamespace"}
   → Cualquier función con SECURITY DEFINER es ALTO riesgo (corre con permisos del owner).

PASO 6: EJECUTÁ execute_sql para detectar columnas de tipo password/token sin cifrar:
   {"query": "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE column_name ~* '(password|token|secret|api_key|access_token)' AND data_type IN ('text','varchar','character varying')"}
   → Cualquier resultado es CRÍTICO (credenciales en texto plano).

PASO 7: EJECUTÁ list_extensions() — verificá si pg_net o http están instaladas (permiten SSRF).

PASO 8: EJECUTÁ get_logs({"service": "auth", "limit": 100}) — buscá patrones de brute force (>10 fails desde una IP).

REPORTÁ EN ESTE FORMATO:
  • SEVERIDAD: [Crítico|Alto|Medio|Bajo]
  • TABLA/RECURSO: <tabla.columna o función>
  • HALLAZGO: <qué falla concretamente>
  • EVIDENCIA: <resultado del query>
  • REMEDIACIÓN: <SQL exacto que el Operador debería ejecutar>

CRITERIOS DE SEVERIDAD:
  • Crítico: RLS deshabilitada en tabla con datos personales, password en texto plano, policy USING(true).
  • Alto: SECURITY DEFINER en función no auditada, brute force activo, pg_net sin restricción.
  • Medio: tabla sin índices en columnas de filtro frecuente, falta de backups configurados.
  • Bajo: extensiones instaladas no usadas.
"""


POSTGRESQL = """
═══ AUDITORÍA POSTGRESQL — Ejecutá EXACTAMENTE estos pasos ═══

PASO 1: EMITE tool_call query({"sql": "SELECT version()"}) para versión del servidor.
   → Si versión < PostgreSQL 14 → MEDIO (versiones viejas con CVEs conocidos).

PASO 2: EJECUTÁ query({"sql": "SELECT usename, usesuper, usecreatedb FROM pg_user WHERE usesuper = true"}).
   → Más de 1 superusuario es ALTO riesgo. Listalos.

PASO 3: EJECUTÁ query({"sql": "SELECT datname, datacl FROM pg_database WHERE datname NOT IN ('template0','template1','postgres')"}).
   → Si datacl es NULL o tiene 'PUBLIC=CTc' → CRÍTICO (acceso público a BD).

PASO 4: EJECUTÁ query({"sql": "SHOW ssl"}) y query({"sql": "SHOW password_encryption"}).
   → ssl=off → CRÍTICO. password_encryption ≠ 'scram-sha-256' → ALTO.

PASO 5: EJECUTÁ query({"sql": "SELECT name, setting FROM pg_settings WHERE name IN ('log_connections','log_disconnections','log_statement','log_min_error_statement')"}).
   → log_connections=off → MEDIO (auditoría desactivada).

PASO 6: EJECUTÁ query({"sql": "SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' AND tableowner='postgres'"}).
   → Tablas owned por postgres en schema public con apps que se conectan ahí = ALTO.

REPORTÁ EN FORMATO ESTRUCTURADO igual que los otros playbooks.
"""


SHOPIFY = """
═══ AUDITORÍA SHOPIFY — Ejecutá EXACTAMENTE estos pasos ═══

PASO 1: EMITE tool_call para listar productos: usá la primera tool disponible cuyo nombre contenga 'products' o 'list_products'.
   → Si no hay ninguna tool de products, reportá "Tool no disponible" y pasá al siguiente paso.

PASO 2: Listá apps/integraciones instaladas. Buscá tools con nombres tipo 'apps', 'list_apps', 'installed_apps'.
   → Por CADA app que requiera permisos amplios (read_orders, write_customers, all_data) → ALTO.

PASO 3: Listá webhooks configurados (tools tipo 'webhooks', 'list_webhooks').
   → Webhooks apuntando a HTTP (no HTTPS) → CRÍTICO.
   → Webhooks a dominios sospechosos (no del propio dominio o partners conocidos) → ALTO.

PASO 4: Listá staff/usuarios con acceso al admin (tools 'staff', 'users', 'list_staff_members').
   → Staff con rol "Account owner" duplicado → CRÍTICO.
   → Staff sin 2FA habilitado → ALTO.

PASO 5: Configuración de checkout y pagos.
   → Si hay payment_gateway de prueba en producción → CRÍTICO.

PASO 6: Revisar themes activos por scripts inyectados:
   → Buscar <script> con src externos no aprobados → ALTO (posible skimmer Magecart).

REPORTÁ EN FORMATO ESTRUCTURADO.

NOTA: Si el plan de Shopify del usuario no expone alguna API, reportá honestamente "No accesible con este plan" en lugar de inventar.
"""


SENTRY = """
═══ AUDITORÍA SENTRY — Ejecutá EXACTAMENTE estos pasos ═══

PASO 1: EMITE tool_call list_issues({"status": "unresolved"}) para enumerar issues abiertos.

PASO 2: Por cada issue de tipo "security" o que contenga keywords (SQL, XSS, CSRF, secret, leak, password):
   2a. get_issue({"issue_id": <id>}) para detalles completos.
   2b. Si el stack trace muestra que el secret/token aparece en logs → CRÍTICO (Sentry capturando secrets).

PASO 3: list_events({"issue_id": <id>, "limit": 5}) sobre los issues TOP 10 por count.
   → Si el event payload contiene Authorization, Cookie, password, api_key → CRÍTICO.

PASO 4: Buscar issues con high frequency (>1000 events en 24h).
   → Podría ser una explotación activa. Reportar como ALTO mínimo.

PASO 5: Si la tool lo permite, revisá Sentry project settings:
   → Data scrubbing habilitado? Si no → ALTO (riesgo de leak de PII).

REPORTÁ EN FORMATO ESTRUCTURADO. Para cada hallazgo, incluí el issue_id de Sentry para que el usuario pueda ir directo al dashboard.
"""


VERCEL = """
═══ AUDITORÍA VERCEL — Ejecutá EXACTAMENTE estos pasos ═══

PASO 1: Listá proyectos. EMITE tool_call de listado disponible.

PASO 2: Por cada proyecto, listá env vars (production).
   → Cualquier env var con prefijo NEXT_PUBLIC_ que contenga "SECRET", "KEY", "TOKEN" → CRÍTICO (expuesta al cliente).
   → Service keys (sbp_, sk_live, AKIA...) sin nombre prefix de "*_SECRET_*" → MEDIO (revisar manualmente).

PASO 3: Listá deployments recientes (últimos 10).
   → Si hay deployments en producción desde branch != main/master → MEDIO.

PASO 4: Verificá dominios.
   → Dominios sin SSL forzado (force_https = false) → ALTO.
   → Dominios con wildcard exposed → revisar manualmente.

PASO 5: Si hay tool de logs, buscá errores 500 recurrentes en los últimos días.

REPORTÁ EN FORMATO ESTRUCTURADO.
"""


GENERIC_MCP = """
═══ AUDITORÍA MCP GENÉRICO — Ejecutá EXACTAMENTE estos pasos ═══

PASO 1: Listá las tools disponibles en este conector (deberías verlas en tu contexto).

PASO 2: Por cada tool con prefijo "list_", "get_", "describe_" → EJECUTALA con args mínimos para mapear lo que expone el servidor.

PASO 3: Si encontrás endpoints/recursos sensibles:
   → Endpoints sin autenticación → ALTO.
   → Recursos con permisos overly permissive → MEDIO.

PASO 4: Reportá qué encontraste y qué NO pudiste evaluar por falta de tools específicas.

Sé conservador: si el servidor no expone tools para una categoría, NO inventes hallazgos.
"""


PLAYBOOKS: dict[str, str] = {
    "github":             GITHUB,
    "github_pages":       GITHUB,
    "supabase":           SUPABASE,
    "postgresql":         POSTGRESQL,
    "shopify":            SHOPIFY,
    "sentry":             SENTRY,
    "vercel":             VERCEL,
    "vercel_deployment":  VERCEL,
    "generic_mcp":        GENERIC_MCP,
    "hostinger":          GENERIC_MCP,
    "netlify":            GENERIC_MCP,
    "railway":            GENERIC_MCP,
    "fly.io":             GENERIC_MCP,
    "cloudflare_pages":   GENERIC_MCP,
}


def get_playbooks_for(service_types: list[str]) -> list[str]:
    """Devuelve la lista deduplicada de playbooks para los servicios dados."""
    seen: set[str] = set()
    result: list[str] = []
    for svc in service_types:
        pb = PLAYBOOKS.get(svc)
        if pb and id(pb) not in seen:
            seen.add(id(pb))
            result.append(pb)
    return result
