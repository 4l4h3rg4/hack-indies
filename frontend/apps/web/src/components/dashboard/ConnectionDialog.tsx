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

interface ServiceField {
  key: string;
  label: string;
  placeholder: string;
  type?: string;
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
      },
      {
        key: "project_ref",
        label: "Project Reference",
        placeholder: "abcdefghijklmnopqrst",
      },
    ],
  },
  {
    id: "shopify",
    label: "Shopify",
    icon: ShoppingCart,
    description: "Tienda online y e-commerce",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "shpat_..." },
      {
        key: "store_url",
        label: "Store URL",
        placeholder: "https://my-store.myshopify.com",
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
      },
    ],
  },
  {
    id: "sentry",
    label: "Sentry",
    icon: Bug,
    description: "Monitoreo de errores y rendimiento",
    fields: [
      { key: "auth_token", label: "Auth Token", placeholder: "sntrys_..." },
      {
        key: "organization_slug",
        label: "Organization Slug",
        placeholder: "my-org",
      },
    ],
  },
  {
    id: "vercel",
    label: "Vercel",
    icon: Globe,
    description: "Deploy frontend, dominios y edge",
    fields: [
      { key: "access_token", label: "Access Token", placeholder: "..." },
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
  const [credentials, setCredentials] = useState<Record<string, string>>({});
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
    setCredentials({});
    setError("");
    setStep("configure");
  };

  const handleFieldChange = (key: string, value: string) => {
    setCredentials((prev) => ({ ...prev, [key]: value }));
  };

  const isFormValid = () => {
    if (!selectedDef) return false;
    return selectedDef.fields.every((f) => credentials[f.key]?.trim());
  };

  const handleTest = async () => {
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
      <DialogContent className="sm:max-w-md">
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
              "Ingresa las credenciales de acceso"}
            {step === "test" &&
              "Verifica que todo funcione antes de guardar"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Select service type */}
        {step === "select" && (
          <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto">
            {SERVICE_DEFS.map((svc) => (
              <Card
                key={svc.id}
                onClick={() => handleSelect(svc.id)}
                className="cursor-pointer hover:bg-accent/40 transition-colors active:scale-95"
              >
                <CardContent className="p-3 flex flex-col items-center text-center gap-1">
                  <div className="flex items-center justify-center size-10 rounded-xl bg-primary/10 text-primary">
                    <svc.icon className="size-5" />
                  </div>
                  <span className="text-sm font-medium">{svc.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">
                    {svc.description}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Step 2: Configure credentials */}
        {step === "configure" && selectedDef && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Nombre del servicio
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
                <Input
                  type={field.type || "text"}
                  value={credentials[field.key] || ""}
                  onChange={(e) =>
                    handleFieldChange(field.key, e.target.value)
                  }
                  placeholder={field.placeholder}
                />
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
                onClick={() => setStep("test")}
                disabled={!isFormValid()}
                className="flex-1 gap-1"
              >
                Continuar
                <ChevronRight className="size-3" />
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
                disabled={
                  saving || (!!testResult && testResult.status !== "ok")
                }
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
