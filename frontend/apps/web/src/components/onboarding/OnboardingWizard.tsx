"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ArrowRight, ArrowLeft, Database, ShoppingCart, Cloud, Server, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const steps = ["Bienvenida", "Servicios", "Análisis"];

const serviceOptions = [
  { id: "supabase", name: "Supabase", icon: Database, desc: "Base de datos y autenticación" },
  { id: "shopify", name: "Shopify", icon: ShoppingCart, desc: "Tienda online y pagos" },
  { id: "aws", name: "AWS", icon: Cloud, desc: "Infraestructura en la nube" },
  { id: "other", name: "Otro", icon: Server, desc: "Otro servicio o API" },
];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  const progress = ((step + 1) / steps.length) * 100;

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full p-4 max-w-lg mx-auto">
      {/* Progress */}
      <div className="w-full mb-6">
        <Progress value={progress} className="h-1.5" />
        <div className="flex justify-between mt-2">
          {steps.map((label, i) => (
            <span
              key={label}
              className={cn(
                "text-[11px] font-medium transition-colors",
                i <= step ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="w-full"
        >
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center justify-center size-20 rounded-2xl bg-primary/10 mb-6"
              >
                <Shield className="size-10 text-primary" />
              </motion.div>
              <h1 className="text-2xl font-bold mb-2">
                Hack<span className="text-primary">Indie</span>
              </h1>
              <p className="text-muted-foreground text-sm mb-6 max-w-xs">
                Soy tu CISO Virtual. Protejo la infraestructura de tu PyME con agentes de IA
                que auditan, alertan y corrigen problemas de seguridad.
              </p>
              <div className="w-full space-y-3">
                <label className="block text-left">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Nombre de tu empresa
                  </span>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Mi PyME"
                    className="mt-1.5 w-full rounded-lg border bg-muted/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Step 1: Services */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold mb-1 text-center">Conecta tus servicios</h2>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Así los agentes pueden auditar tu infraestructura
              </p>
              <div className="grid grid-cols-2 gap-2">
                {serviceOptions.map((svc) => {
                  const isSelected = selectedServices.includes(svc.id);
                  return (
                    <Card
                      key={svc.id}
                      onClick={() => toggleService(svc.id)}
                      className={cn(
                        "cursor-pointer transition-all active:scale-95",
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "hover:bg-accent/40"
                      )}
                    >
                      <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                        <div
                          className={cn(
                            "flex items-center justify-center size-10 rounded-xl",
                            isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          )}
                        >
                          <svc.icon className="size-5" />
                        </div>
                        <span className="text-sm font-medium">{svc.name}</span>
                        <span className="text-[10px] text-muted-foreground">{svc.desc}</span>
                        {isSelected && (
                          <Check className="size-3.5 text-primary absolute top-2 right-2" />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: First scan */}
          {step === 2 && (
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="flex items-center justify-center size-20 rounded-2xl bg-primary/10 mb-6"
              >
                <Shield className="size-10 text-primary" />
              </motion.div>
              <h2 className="text-lg font-semibold mb-1">¡Todo listo!</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                {selectedServices.length > 0
                  ? `Vas a conectar ${selectedServices.length} servicio(s). Los agentes comenzarán a trabajar en cuanto termines.`
                  : "Puedes conectar servicios más tarde desde el panel. Los agentes están listos para ayudarte."}
              </p>
              <Button onClick={onComplete} size="lg" className="gap-2">
                Ir al Dashboard
                <ArrowRight className="size-4" />
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation (only for steps 0-1) */}
      {step < 2 && (
        <div className="flex justify-between w-full mt-8">
          <Button
            variant="ghost"
            onClick={() => setStep(step - 1)}
            disabled={step === 0}
            className="gap-1"
          >
            <ArrowLeft className="size-4" />
            Atrás
          </Button>
          <Button onClick={() => setStep(step + 1)} className="gap-1" disabled={step === 0 && !companyName.trim()}>
            {step === 1 ? "Finalizar" : "Siguiente"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
