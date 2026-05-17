"use client";

import { useState } from "react";
import {
  Database,
  ShoppingCart,
  Cloud,
  Server,
  Check,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Globe,
  GitBranch,
  Bug,
  ExternalLink,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useApi } from "@/hooks/useApi";
import { useDashboard } from "@/hooks/useDashboard";

interface ServiceField {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  hint?: string;
  helpUrl?: string;
  helpLabel?: string;
  options?: { value: string; label: string }[];
  isConnectionsSelector?: boolean;
}

interface ServiceDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  fields: ServiceField[];
}

const SERVICE_DEFS: ServiceDef[] = [
  {
    id: "supabase",
    label: "Supabase",
    icon: Database,
    description: "Base de datos PostgreSQL y autenticacion",
    fields: [
      {
        key: "access_token",
        label: "Personal Access Token (PAT)",
        placeholder: "sbp_...",
        hint: "Token personal de tu cuenta Supabase. NO es la service key del proyecto.",
        helpUrl: "https://supabase.com/dashboard/account/tokens",
        helpLabel: "Generar token → Account → Access Tokens",
      },
      {
        key: "project_ref",
        label: "Project Reference",
        placeholder: "abcdefghijklmnopqrst",
        hint: "ID único de tu proyecto. Lo ves en la URL del dashboard: supabase.com/dashboard/project/[ref]",
        helpUrl: "https://supabase.com/dashboard",
        helpLabel: "Ver en Settings → General → Reference ID",
      },
    ],
  },
  {
    id: "shopify",
    label: "Shopify",
    icon: ShoppingCart,
    description: "Tienda online y e-commerce",
    fields: [
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "shpat_...",
        hint: "Token de una Custom App en tu tienda. Requiere permisos de lectura en productos y pedidos.",
        helpUrl: "https://admin.shopify.com/settings/apps/development",
        helpLabel: "Crear en Settings → Apps → Develop apps",
      },
      {
        key: "store_url",
        label: "Store URL",
        placeholder: "https://my-store.myshopify.com",
        hint: "URL completa de tu tienda en formato .myshopify.com",
      },
    ],
  },
  {
    id: "github",
    label: "GitHub",
    icon: GitBranch,
    description: "Repositorios, CI/CD y dependencias",
    fields: [
      {
        key: "personal_access_token",
        label: "Personal Access Token",
        placeholder: "ghp_...",
        hint: "Necesita permisos: repo, read:org, read:packages. Usa un Fine-grained token para más seguridad.",
        helpUrl: "https://github.com/settings/tokens/new",
        helpLabel: "Crear en Settings → Developer settings → Tokens",
      },
    ],
  },
  {
    id: "postgresql",
    label: "PostgreSQL",
    icon: Database,
    description: "Base de datos PostgreSQL directa",
    fields: [
      {
        key: "connection_string",
        label: "Connection String",
        placeholder: "postgresql://user:pass@host:5432/db",
        hint: "Formato: postgresql://usuario:contraseña@host:puerto/base_de_datos",
      },
    ],
  },
  {
    id: "sentry",
    label: "Sentry",
    icon: Bug,
    description: "Monitoreo de errores y rendimiento",
    fields: [
      {
        key: "auth_token",
        label: "Auth Token",
        placeholder: "sntrys_...",
        hint: "Token de autenticación de tu cuenta Sentry. Necesita permisos de lectura en proyectos y eventos.",
        helpUrl: "https://sentry.io/settings/account/api/auth-tokens/",
        helpLabel: "Crear en Settings → Account → API → Auth Tokens",
      },
      {
        key: "organization_slug",
        label: "Organization Slug",
        placeholder: "mi-empresa",
        hint: "El slug de tu org aparece en la URL de Sentry: sentry.io/organizations/[slug]",
      },
    ],
  },
  {
    id: "vercel",
    label: "Vercel",
    icon: Globe,
    description: "Deploy frontend, dominios y edge",
    fields: [
      {
        key: "access_token",
        label: "Access Token",
        placeholder: "...",
        hint: "Token personal de tu cuenta Vercel con acceso a proyectos.",
        helpUrl: "https://vercel.com/account/settings/tokens",
        helpLabel: "Crear en Account Settings → Tokens",
      },
    ],
  },
  {
    id: "vercel_deployment",
    label: "Sitio Web / Deployment",
    icon: Globe,
    description: "Un sitio web, app o deployment (Hostinger, Vercel, Netlify, etc.)",
    fields: [
      {
        key: "meta.platform",
        label: "Plataforma",
        type: "select",
        options: [
          { value: "vercel", label: "Vercel" },
          { value: "hostinger", label: "Hostinger" },
          { value: "netlify", label: "Netlify" },
          { value: "aws", label: "AWS" },
          { value: "railway", label: "Railway" },
          { value: "fly.io", label: "Fly.io" },
          { value: "github_pages", label: "GitHub Pages" },
          { value: "cloudflare_pages", label: "Cloudflare Pages" },
          { value: "otro", label: "Otro" }
        ],
        placeholder: "Seleccionar plataforma",
      },
      {
        key: "meta.site_name",
        label: "Nombre del sitio",
        placeholder: "Ej: Web de promoción",
      },
      {
        key: "meta.url",
        label: "URL",
        placeholder: "https://mi-sitio.com",
      },
      {
        key: "meta.platform_id",
        label: "Project ID (opcional)",
        placeholder: "prj_...",
      },
      {
        key: "meta.connected_services",
        label: "Servicios que utiliza este sitio",
        isConnectionsSelector: true,
      }
    ],
  },
  {
    id: "generic_mcp",
    label: "HTTP MCP",
    icon: Server,
    description: "Cualquier servidor MCP vía HTTP",
    fields: [
      {
        key: "url",
        label: "MCP Endpoint URL",
        placeholder: "https://mcp.example.com/sse",
        hint: "URL del servidor MCP compatible con el protocolo SSE o Streamable HTTP.",
      },
    ],
  },
];

interface ConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function ConnectionDialog({
  open,
  onOpenChange,
  onCreated,
}: ConnectionDialogProps) {
  const [step, setStep] = useState<"select" | "configure" | "test">("select");
  const [serviceType, setServiceType] = useState<string>("");
  const [serviceName, setServiceName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, any>>({});
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: string;
    tools?: string[];
    tool_count?: number;
    message?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const api = useApi();
  const { data: dashboard } = useDashboard();

  const selectedDef = SERVICE_DEFS.find((s) => s.id === serviceType);

  const reset = () => {
    setStep("select");
    setServiceType("");
    setServiceName("");
    setCredentials({});
    setTestResult(null);
    setError("");
    setTesting(false);
    setSaving(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSelect = (id: string) => {
    setServiceType(id);
    setCredentials(id === "vercel_deployment" ? { meta: { platform: "vercel", connected_services: [] } } : {});
    setError("");
    setStep("configure");
  };

  const handleFieldChange = (key: string, value: any) => {
    setCredentials((prev) => {
      if (key.startsWith("meta.")) {
        const metaKey = key.replace("meta.", "");
        return {
          ...prev,
          meta: {
            ...prev.meta,
            [metaKey]: value,
          },
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const getFieldValue = (key: string) => {
    if (key.startsWith("meta.")) {
      return credentials.meta?.[key.replace("meta.", "")] || "";
    }
    return credentials[key] || "";
  };

  const isFormValid = () => {
    if (!selectedDef) return false;
    return selectedDef.fields.every((f) => {
      if (f.key === "meta.platform_id") return true; // optional
      if (f.isConnectionsSelector) return true; // optional
      const val = getFieldValue(f.key);
      return typeof val === "string" ? val.trim().length > 0 : true;
    });
  };

  const handleTest = async () => {
    if (serviceType === "vercel_deployment") {
      handleSave(); // Skip test for deployments
      return;
    }

    setTesting(true);
    setTestResult(null);
    setError("");
    try {
      const result = await api.testConnection(serviceType, credentials);
      setTestResult(result);
    } catch {
      setError("Error al probar la conexión");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await api.createConnection(
        serviceType,
        serviceName || selectedDef?.label || serviceType,
        credentials
      );
      reset();
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar la conexion"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" && "Conectar servicio"}
            {step === "configure" && selectedDef?.label}
            {step === "test" && "Verificar conexión"}
          </DialogTitle>
          <DialogDescription>
            {step === "select" &&
              "Elige el servicio que quieres conectar a HackIndie"}
            {step === "configure" &&
              "Ingresa los detalles"}
            {step === "test" &&
              "Verifica que todo funcione antes de guardar"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select service type */}
        {step === "select" && (
          <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1">
            {SERVICE_DEFS.map((svc) => (
              <button
                key={svc.id}
                onClick={() => handleSelect(svc.id)}
                className="group flex items-center gap-3 rounded-lg border border-border/50 bg-card/50 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.99]"
              >
                <div className="flex items-center justify-center size-9 rounded-lg bg-primary/10 text-primary flex-shrink-0 transition-colors group-hover:bg-primary/20">
                  <svc.icon className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-tight">
                    {svc.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
                    {svc.description}
                  </p>
                </div>
                <ChevronRight className="size-3.5 text-muted-foreground/50 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Configure credentials */}
        {step === "configure" && selectedDef && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Nombre {serviceType === "vercel_deployment" ? "del componente" : "del servicio"}
              </label>
              <Input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder={selectedDef.label}
              />
            </div>

            {selectedDef.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {field.label}
                </label>

                {field.type === "select" ? (
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={getFieldValue(field.key)}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  >
                    {field.options?.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                ) : field.isConnectionsSelector ? (
                  <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-border/50 rounded-md p-2 bg-card/50">
                    {dashboard?.connections?.filter(c => c.service_type !== 'vercel_deployment').map(conn => {
                      const isChecked = (credentials.meta?.connected_services || []).includes(conn.id);
                      return (
                        <label key={conn.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted/50 rounded">
                          <input 
                            type="checkbox" 
                            className="rounded border-border text-primary focus:ring-primary"
                            checked={isChecked}
                            onChange={(e) => {
                              const curr = credentials.meta?.connected_services || [];
                              if (e.target.checked) {
                                handleFieldChange(field.key, [...curr, conn.id]);
                              } else {
                                handleFieldChange(field.key, curr.filter((id: string) => id !== conn.id));
                              }
                            }}
                          />
                          <span className="text-sm">{conn.service_name || conn.service_type}</span>
                        </label>
                      );
                    })}
                    {(!dashboard?.connections || dashboard.connections.filter(c => c.service_type !== 'vercel_deployment').length === 0) && (
                      <span className="text-xs text-muted-foreground italic">No hay servicios conectados.</span>
                    )}
                  </div>
                ) : (
                  <Input
                    type={field.type || "text"}
                    value={getFieldValue(field.key)}
                    onChange={(e) =>
                      handleFieldChange(field.key, e.target.value)
                    }
                    placeholder={field.placeholder}
                  />
                )}
                
                {(field.hint || field.helpUrl) && (
                  <div className="rounded-md bg-muted/50 border border-border/50 px-3 py-2 space-y-1">
                    {field.hint && (
                      <div className="flex items-start gap-1.5">
                        <Info className="size-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {field.hint}
                        </p>
                      </div>
                    )}
                    {field.helpUrl && (
                      <a
                        href={field.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline font-medium w-fit"
                      >
                        <ExternalLink className="size-3" />
                        {field.helpLabel || field.helpUrl}
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("select")}
                className="gap-1"
              >
                <ArrowLeft className="size-3" />
                Atrás
              </Button>
              <Button
                size="sm"
                onClick={() => serviceType === "vercel_deployment" ? handleSave() : setStep("test")}
                disabled={!isFormValid()}
                className="flex-1 gap-1"
              >
                {serviceType === "vercel_deployment" ? (
                  <>
                    {saving && <Loader2 className="size-3 animate-spin" />}
                    Guardar Deployment
                  </>
                ) : (
                  <>
                    Continuar
                    <ChevronRight className="size-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Test & save */}
        {step === "test" && (
          <div className="space-y-3">
            {testResult ? (
              <div
                className={cn(
                  "rounded-lg p-3 text-sm",
                  testResult.status === "ok"
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                    : "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
                )}
              >
                {testResult.status === "ok" ? (
                  <div className="flex items-center gap-2">
                    <Check className="size-4" />
                    <span>
                      Conexión exitosa — {testResult.tool_count} herramientas
                      disponibles
                    </span>
                  </div>
                ) : (
                  <span>{testResult.message || "Error de conexión"}</span>
                )}
                {testResult.tools && testResult.tools.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {testResult.tools.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] bg-background/50 rounded px-1.5 py-0.5"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Haz clic en &ldquo;Probar conexión&rdquo; para verificar que
                las credenciales son correctas.
              </p>
            )}

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {testResult?.status === "error" && (
              <div className="rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2">
                <div className="flex items-start gap-1.5">
                  <Info className="size-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
                    Podés guardar igualmente — el agente intentará conectarse cuando lo necesite. Asegurate de que las credenciales sean correctas.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("configure")}
                className="gap-1"
              >
                <ArrowLeft className="size-3" />
                Atrás
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing}
                className="flex-1 gap-1"
              >
                {testing && <Loader2 className="size-3 animate-spin" />}
                Probar conexión
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1"
              >
                {saving && <Loader2 className="size-3 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        )}

        <DialogFooter showCloseButton>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
