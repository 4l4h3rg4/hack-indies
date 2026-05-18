"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, Shield, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="size-[30px] rounded-md border border-border bg-secondary/40 hover:bg-secondary hover:border-border/80 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
      title="Cambiar tema"
    >
      {theme === "light" ? (
        <Moon className="size-[14px]" strokeWidth={1.7} />
      ) : (
        <Sun className="size-[14px]" strokeWidth={1.7} />
      )}
      <span className="sr-only">Cambiar tema</span>
    </button>
  );
}

export type AppSection = "dashboard" | "conexiones" | "alertas" | "reportes";

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "conexiones", label: "Conexiones" },
  { id: "alertas", label: "Alertas" },
  { id: "reportes", label: "Reportes" },
];

interface AppHeaderProps {
  active?: AppSection;
  onActiveChange?: (section: AppSection) => void;
}

export function AppHeader({ active: activeProp, onActiveChange }: AppHeaderProps = {}) {
  const { user, signOut } = useAuth();
  const [activeInternal, setActiveInternal] = useState<AppSection>("dashboard");
  const active = activeProp ?? activeInternal;
  const setActive = onActiveChange ?? setActiveInternal;

  const initials = (() => {
    if (!user) return "";
    const meta = (user.user_metadata as Record<string, string> | undefined) || {};
    const name = meta.full_name || meta.name || user.email || "";
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  })();

  return (
    <header className="sticky top-0 z-40 flex h-12 items-center gap-3.5 border-b border-border bg-card/95 backdrop-blur-md px-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center size-7 rounded-md bg-brand-gradient flex-shrink-0 shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
          <Shield className="size-[14px] text-white" strokeWidth={2.2} />
        </div>
        <span className="text-sm font-bold tracking-tight">HackIndie</span>
      </div>

      <div className="flex-1" />

      {/* Segmented nav */}
      {user && (
        <nav className="hidden md:flex items-center gap-0.5 p-[3px] rounded-lg bg-secondary/50 border border-border">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={cn(
                "px-3 py-[5px] text-[12px] font-medium rounded-md transition-colors",
                active === item.id
                  ? "bg-accent text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex items-center gap-2">
        {user && (
          <>
            {/* Notifications */}
            <button
              className="relative size-[30px] rounded-md border border-border bg-secondary/40 hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
              title="Notificaciones"
            >
              <Bell className="size-[14px]" strokeWidth={1.7} />
              <span className="absolute top-[5px] right-[5px] size-[6px] rounded-full bg-destructive ring-[1.5px] ring-card" />
              <span className="sr-only">Notificaciones</span>
            </button>
          </>
        )}

        <ThemeToggle />

        {user && (
          <>
            {/* User avatar (just visual) */}
            <div
              className="size-[30px] rounded-md flex items-center justify-center text-[11px] font-bold text-primary border border-primary/25"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--primary) / 0.22) 0%, hsl(var(--background)) 100%)",
              }}
              title={user.email || ""}
            >
              {initials || "U"}
            </div>

            {/* Explicit logout button */}
            <button
              onClick={signOut}
              className="size-[30px] rounded-md border border-border bg-secondary/40 hover:bg-destructive/15 hover:border-destructive/30 hover:text-destructive transition-colors flex items-center justify-center text-muted-foreground"
              title="Cerrar sesión"
            >
              <LogOut className="size-[14px]" strokeWidth={1.7} />
              <span className="sr-only">Cerrar sesión</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
