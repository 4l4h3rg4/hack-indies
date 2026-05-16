"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="size-10">
        <span className="sr-only">Cambiar tema</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="size-10"
    >
      {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
      <span className="sr-only">Cambiar tema</span>
    </Button>
  );
}

export function AppHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background/80 backdrop-blur-md px-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10 flex-shrink-0">
          <Shield className="size-4 text-primary" />
        </div>
        <span className="text-base font-semibold tracking-tight truncate">
          Hack<span className="text-primary">Indie</span>
        </span>
      </div>

      <div className="flex items-center gap-1">
        {user && (
          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="size-10"
            title="Cerrar sesión"
          >
            <LogOut className="size-4" />
            <span className="sr-only">Cerrar sesión</span>
          </Button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
