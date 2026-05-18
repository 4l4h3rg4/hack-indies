"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Mail,
  Lock,
  Building,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/layout/AppHeader";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: companyName,
        },
      },
    });

    if (error) {
      setError(
        error.message === "User already registered"
          ? "Este email ya está registrado"
          : error.message
      );
      setLoading(false);
    } else {
      router.push("/?welcome=true");
      router.refresh();
    }
  };

  type FieldProps = {
    icon: typeof Mail;
    type?: string;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    label: string;
    required?: boolean;
  };

  const Field = ({ icon: Icon, type = "text", placeholder, value, onChange, label, required }: FieldProps) => (
    <label className="block">
      <span className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">
        {label}
      </span>
      <div className="relative">
        <Icon
          className="absolute left-3 top-1/2 -translate-y-1/2 size-[14px] text-muted-foreground/70"
          strokeWidth={1.8}
        />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={loading}
          className="w-full h-10 pl-9 pr-3 rounded-md bg-secondary/40 border border-border focus:border-primary/40 focus:bg-secondary outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-colors"
        />
      </div>
    </label>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{
            background:
              "radial-gradient(ellipse at top, hsl(var(--primary) / 0.08), transparent 60%), radial-gradient(ellipse at bottom right, hsl(var(--brand-accent) / 0.05), transparent 60%)",
          }}
        />

        <div className="relative w-full max-w-[400px]">
          <div className="rounded-2xl border border-border bg-card shadow-[0_24px_60px_-12px_rgba(0,0,0,0.5)] p-7">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="size-12 rounded-xl bg-brand-gradient flex items-center justify-center mb-3.5 shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.5)]">
                <Shield className="size-5 text-white" strokeWidth={2.2} />
              </div>
              <h1 className="text-[19px] font-bold tracking-tight">
                Crear cuenta
              </h1>
              <p className="text-[12.5px] text-muted-foreground mt-1">
                Tu CISO Virtual gratuito para PyMEs
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleSignup} className="flex flex-col gap-3">
              <Field
                icon={User}
                placeholder="Nombre completo"
                value={fullName}
                onChange={setFullName}
                label="Nombre"
                required
              />

              <Field
                icon={Building}
                placeholder="Acme Inc."
                value={companyName}
                onChange={setCompanyName}
                label="Empresa"
              />

              <Field
                icon={Mail}
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={setEmail}
                label="Email"
                required
              />

              {/* Password (custom because of eye toggle) */}
              <label className="block">
                <span className="text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5 block">
                  Contraseña
                </span>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-[14px] text-muted-foreground/70"
                    strokeWidth={1.8}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="w-full h-10 pl-9 pr-9 rounded-md bg-secondary/40 border border-border focus:border-primary/40 focus:bg-secondary outline-none text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="size-[14px]" strokeWidth={1.8} />
                    ) : (
                      <Eye className="size-[14px]" strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 h-10 rounded-md bg-primary text-white font-semibold text-[13px] flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight className="size-[14px]" strokeWidth={2} />
                  </>
                )}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                o
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <p className="text-center text-[12.5px] text-muted-foreground">
              ¿Ya tenés cuenta?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline font-semibold"
              >
                Iniciar sesión
              </Link>
            </p>
          </div>

          <p className="text-center text-[10.5px] text-muted-foreground/60 mt-4">
            Al crear una cuenta aceptás nuestros términos
          </p>
        </div>
      </main>
    </div>
  );
}
