"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, BookOpen, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmationAction {
  title: string;
  description: string;
  service: string;
  impact: string;
  riskIfNotDone: string;
}

interface ConfirmationCardProps {
  action: ConfirmationAction;
  onApprove: () => Promise<void>;
  onViewInstructions: () => void;
}

export function ConfirmationCard({
  action,
  onApprove,
  onViewInstructions,
}: ConfirmationCardProps) {
  const [state, setState] = useState<"idle" | "executing" | "done">("idle");
  const [result, setResult] = useState<string>("");

  const handleApprove = async () => {
    setState("executing");
    try {
      await onApprove();
      setState("done");
      setResult("Acción completada exitosamente.");
    } catch {
      setState("idle");
      setResult("Error al ejecutar la acción.");
    }
  };

  return (
    <div className="flex justify-start mb-4 animate-slide-in-up">
      <Card className="max-w-[85%] border-primary/20 bg-primary/5 overflow-hidden">
        <CardHeader className="pb-2 px-4 pt-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center size-7 rounded-full bg-risk-high/20 text-risk-high">
              <AlertTriangle className="size-3.5" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">
                Autorización requerida
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">
                El Operador necesita tu permiso
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-0 space-y-2 text-sm">
          <div>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Acción
            </span>
            <p className="font-medium">{action.title}</p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">
              {action.service}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {action.impact}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground">{action.description}</p>

          <div className="flex items-start gap-2 text-xs bg-muted/50 rounded-lg p-2">
            <AlertTriangle className="size-3 text-risk-high flex-shrink-0 mt-0.5" />
            <span>{action.riskIfNotDone}</span>
          </div>

          {result && (
            <p
              className={cn(
                "text-xs p-2 rounded-lg",
                state === "done"
                  ? "bg-risk-low/10 text-risk-low"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {result}
            </p>
          )}
        </CardContent>

        <Separator className="my-2" />

        <CardFooter className="px-4 pb-3 pt-0 flex gap-2">
          {state === "idle" ? (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={handleApprove}
                className="flex-1 h-9 text-xs"
              >
                <ShieldCheck className="size-3.5" />
                <span className="ml-1.5">Permitir que la IA lo solucione</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onViewInstructions}
                className="h-9 text-xs"
              >
                <BookOpen className="size-3.5" />
                <span className="ml-1.5 hidden sm:inline">Ver instrucciones</span>
              </Button>
            </>
          ) : state === "executing" ? (
            <Button disabled size="sm" variant="default" className="flex-1 h-9 text-xs">
              <Loader2 className="size-3.5 animate-spin" />
              <span className="ml-1.5">Ejecutando...</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-xs text-risk-low font-medium px-2">
              <CheckCircle2 className="size-4" />
              Completado
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
