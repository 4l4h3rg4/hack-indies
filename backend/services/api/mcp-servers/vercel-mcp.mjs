#!/usr/bin/env node
/**
 * HackIndie — Vercel MCP Server
 * Exposes Vercel REST API as MCP tools.
 * Runs locally via stdio — no third-party proxy, tokens never leave the container.
 *
 * Env vars:
 *   VERCEL_TOKEN  — Vercel personal access token
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const TOKEN = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || "";
const BASE  = "https://api.vercel.com";

// ── Vercel REST helper ────────────────────────────────────────────────────────

async function vFetch(path) {
  if (!TOKEN) throw new Error("VERCEL_TOKEN no configurado.");
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vercel API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_projects",
    description:
      "Lista todos los proyectos de Vercel con configuraciones de seguridad relevantes " +
      "(password protection, SSO, autoExposeSystemEnvs, publicSource).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_deployments",
    description: "Lista los últimos deployments de un proyecto Vercel.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "ID o nombre del proyecto (ej: prj_xxx o 'mi-tienda')",
        },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_environment_variable_names",
    description:
      "Lista los NOMBRES de las variables de entorno de un proyecto (sin valores — son datos sensibles). " +
      "Útil para detectar variables expuestas en entornos incorrectos o con nombres inseguros.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID del proyecto Vercel" },
      },
      required: ["project_id"],
    },
  },
  {
    name: "list_domains",
    description:
      "Lista todos los dominios de la cuenta Vercel con estado SSL y fecha de vencimiento.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_project_security_settings",
    description:
      "Obtiene configuraciones de seguridad de un proyecto Vercel: " +
      "password protection, SSO, IPs de confianza, bypass de protección, exposición de env vars del sistema.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "ID del proyecto Vercel" },
      },
      required: ["project_id"],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────

async function callTool(name, args) {
  switch (name) {
    case "list_projects": {
      const data = await vFetch("/v9/projects?limit=100");
      const projects = (data.projects || []).map((p) => ({
        id: p.id,
        name: p.name,
        framework: p.framework ?? "unknown",
        latestDeploymentUrl: p.latestDeployments?.[0]?.url ?? null,
        passwordProtection: p.passwordProtection ? "habilitada" : "deshabilitada",
        ssoProtection: p.ssoProtection ? "habilitada" : "deshabilitada",
        autoExposeSystemEnvs: p.autoExposeSystemEnvs
          ? "EXPONE env vars del sistema (riesgo)"
          : "no expone",
        publicSource: p.publicSource
          ? "código fuente público"
          : "código fuente privado",
      }));
      return JSON.stringify(projects, null, 2);
    }

    case "list_deployments": {
      const data = await vFetch(
        `/v6/deployments?projectId=${encodeURIComponent(args.project_id)}&limit=10`
      );
      const deploys = (data.deployments || []).map((d) => ({
        id: d.uid,
        url: d.url,
        state: d.state,
        target: d.target ?? "preview",
        creator: d.creator?.username ?? null,
        createdAt: new Date(d.createdAt).toISOString(),
      }));
      return JSON.stringify(deploys, null, 2);
    }

    case "list_environment_variable_names": {
      const data = await vFetch(
        `/v9/projects/${encodeURIComponent(args.project_id)}/env?decrypt=false`
      );
      const envs = (data.envs || []).map((e) => ({
        key: e.key,
        target: e.target,  // development / preview / production
        type: e.type,      // plain / secret / encrypted
        // Nunca devolver valores — datos sensibles
      }));
      return JSON.stringify(
        {
          count: envs.length,
          warning:
            "Los valores no se muestran por seguridad. Revisar si hay vars " +
            "sensibles expuestas en entornos 'preview' o 'development'.",
          variables: envs,
        },
        null,
        2
      );
    }

    case "list_domains": {
      const data = await vFetch("/v5/domains?limit=100");
      const domains = (data.domains || []).map((d) => ({
        name: d.name,
        verified: d.verified,
        expiresAt: d.expiresAt ? new Date(d.expiresAt).toISOString() : null,
        serviceType: d.serviceType ?? "unknown",
        nameservers: d.nameservers ?? [],
      }));
      return JSON.stringify(domains, null, 2);
    }

    case "get_project_security_settings": {
      const data = await vFetch(
        `/v9/projects/${encodeURIComponent(args.project_id)}`
      );
      return JSON.stringify(
        {
          id: data.id,
          name: data.name,
          framework: data.framework,
          passwordProtection: data.passwordProtection || "no configurada",
          ssoProtection: data.ssoProtection || "no configurada",
          autoExposeSystemEnvs: data.autoExposeSystemEnvs,
          publicSource: data.publicSource,
          trustedIps: data.trustedIps || "sin restricción de IPs",
          protectionBypass: data.protectionBypass
            ? Object.keys(data.protectionBypass).length > 0
              ? "tiene reglas de bypass (revisar)"
              : "sin bypass"
            : "no configurado",
          gitComments: data.gitComments,
        },
        null,
        2
      );
    }

    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}

// ── MCP server setup ──────────────────────────────────────────────────────────

const server = new Server(
  { name: "vercel-mcp-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    const text = await callTool(name, args);
    return { content: [{ type: "text", text }] };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
