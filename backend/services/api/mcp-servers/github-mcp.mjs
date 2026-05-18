#!/usr/bin/env node
/**
 * HackIndie — GitHub MCP Server
 * Read-only GitHub security audit tools over stdio.
 *
 * Env vars:
 *   GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN — GitHub PAT
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "";
const BASE = "https://api.github.com";

async function ghFetch(path) {
  if (!TOKEN) throw new Error("GITHUB_TOKEN no configurado.");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "HackIndie-CISO-Virtual/1.0",
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function paginated(path, limit = 100) {
  const out = [];
  let page = 1;
  while (out.length < limit) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await ghFetch(`${path}${sep}per_page=100&page=${page}`);
    const rows = Array.isArray(data) ? data : data?.items || [];
    out.push(...rows);
    if (!rows.length || rows.length < 100) break;
    page += 1;
  }
  return out.slice(0, limit);
}

const TOOLS = [
  {
    name: "get_authenticated_user",
    description: "Obtiene el usuario autenticado del token de GitHub.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_repositories",
    description:
      "Lista repositorios accesibles por el token. Úsalo SIEMPRE al iniciar una auditoría de GitHub.",
    inputSchema: {
      type: "object",
      properties: {
        visibility: {
          type: "string",
          enum: ["all", "public", "private"],
          description: "Visibilidad a listar. Default: all.",
        },
        limit: { type: "number", description: "Máximo de repos. Default: 100." },
      },
    },
  },
  {
    name: "search_repositories",
    description: "Busca repositorios por query GitHub Search API.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Query, ej: 'hack-indies in:name user:4l4h3rg4'." },
        limit: { type: "number", description: "Máximo de resultados. Default: 20." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_file_contents",
    description: "Lee un archivo de un repositorio. Útil para auditar workflows/configs/secrets.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "Ruta del archivo, ej: '.github/workflows/deploy.yml'." },
        ref: { type: "string", description: "Branch/ref opcional." },
      },
      required: ["owner", "repo", "path"],
    },
  },
  {
    name: "list_directory",
    description: "Lista archivos/directorios de una ruta del repo. Útil para descubrir workflows.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        path: { type: "string", description: "Ruta de directorio. Default: raíz." },
        ref: { type: "string", description: "Branch/ref opcional." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "get_branch_protection",
    description: "Consulta branch protection para una rama. Devuelve si está ausente o configurada.",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        branch: { type: "string", description: "Branch. Default: default_branch del repo o main." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_dependabot_alerts",
    description: "Lista alertas Dependabot abiertas del repo (si el token tiene permisos).",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        limit: { type: "number", description: "Máximo de alertas. Default: 50." },
      },
      required: ["owner", "repo"],
    },
  },
  {
    name: "list_secret_scanning_alerts",
    description: "Lista alertas de secret scanning abiertas del repo (si el token tiene permisos).",
    inputSchema: {
      type: "object",
      properties: {
        owner: { type: "string" },
        repo: { type: "string" },
        limit: { type: "number", description: "Máximo de alertas. Default: 50." },
      },
      required: ["owner", "repo"],
    },
  },
];

function repoSummary(repo) {
  return {
    id: repo.id,
    full_name: repo.full_name,
    private: repo.private,
    archived: repo.archived,
    disabled: repo.disabled,
    fork: repo.fork,
    default_branch: repo.default_branch,
    pushed_at: repo.pushed_at,
    visibility: repo.visibility,
    open_issues_count: repo.open_issues_count,
    has_actions: repo.has_actions,
    html_url: repo.html_url,
  };
}

async function callTool(name, args) {
  switch (name) {
    case "get_authenticated_user": {
      const u = await ghFetch("/user");
      return JSON.stringify({ login: u.login, id: u.id, type: u.type, html_url: u.html_url }, null, 2);
    }
    case "list_repositories": {
      const visibility = args.visibility || "all";
      const limit = Number(args.limit || 100);
      const repos = await paginated(
        `/user/repos?visibility=${encodeURIComponent(visibility)}&affiliation=owner,collaborator,organization_member&sort=pushed`,
        limit,
      );
      return JSON.stringify(repos.map(repoSummary), null, 2);
    }
    case "search_repositories": {
      const limit = Number(args.limit || 20);
      const data = await ghFetch(`/search/repositories?q=${encodeURIComponent(args.query)}&per_page=${Math.min(limit, 100)}`);
      return JSON.stringify((data.items || []).slice(0, limit).map(repoSummary), null, 2);
    }
    case "get_file_contents": {
      const ref = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
      const data = await ghFetch(`/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(args.path).replaceAll("%2F", "/")}${ref}`);
      if (Array.isArray(data)) return JSON.stringify(data.map((x) => ({ name: x.name, path: x.path, type: x.type })), null, 2);
      const decoded = data.encoding === "base64" && data.content
        ? Buffer.from(data.content, "base64").toString("utf8")
        : data.content || "";
      return JSON.stringify({ path: data.path, sha: data.sha, size: data.size, content: decoded.slice(0, 20000) }, null, 2);
    }
    case "list_directory": {
      const path = args.path || "";
      const ref = args.ref ? `?ref=${encodeURIComponent(args.ref)}` : "";
      const data = await ghFetch(`/repos/${args.owner}/${args.repo}/contents/${encodeURIComponent(path).replaceAll("%2F", "/")}${ref}`);
      const rows = Array.isArray(data) ? data : [data];
      return JSON.stringify(rows.map((x) => ({ name: x.name, path: x.path, type: x.type, size: x.size })), null, 2);
    }
    case "get_branch_protection": {
      let branch = args.branch;
      if (!branch) {
        const repo = await ghFetch(`/repos/${args.owner}/${args.repo}`);
        branch = repo.default_branch || "main";
      }
      try {
        const data = await ghFetch(`/repos/${args.owner}/${args.repo}/branches/${encodeURIComponent(branch)}/protection`);
        return JSON.stringify({ branch, protected: true, settings: data }, null, 2);
      } catch (err) {
        if (String(err.message).includes("404")) return JSON.stringify({ branch, protected: false, message: "Branch protection no configurado." }, null, 2);
        throw err;
      }
    }
    case "list_dependabot_alerts": {
      const limit = Number(args.limit || 50);
      const alerts = await paginated(`/repos/${args.owner}/${args.repo}/dependabot/alerts?state=open`, limit);
      return JSON.stringify(alerts.map((a) => ({
        number: a.number,
        state: a.state,
        package: a.dependency?.package?.name,
        ecosystem: a.dependency?.package?.ecosystem,
        severity: a.security_advisory?.severity,
        ghsa_id: a.security_advisory?.ghsa_id,
        vulnerable_range: a.security_vulnerability?.vulnerable_version_range,
      })), null, 2);
    }
    case "list_secret_scanning_alerts": {
      const limit = Number(args.limit || 50);
      const alerts = await paginated(`/repos/${args.owner}/${args.repo}/secret-scanning/alerts?state=open`, limit);
      return JSON.stringify(alerts.map((a) => ({
        number: a.number,
        state: a.state,
        secret_type: a.secret_type,
        secret_type_display_name: a.secret_type_display_name,
        resolution: a.resolution,
        created_at: a.created_at,
        url: a.html_url,
      })), null, 2);
    }
    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}

const server = new Server(
  { name: "github-audit-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const text = await callTool(name, args);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
