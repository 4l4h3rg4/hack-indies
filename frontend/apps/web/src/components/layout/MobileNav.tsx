"use client";

import { cn } from "@/lib/utils";
import { LayoutDashboard, MessageSquare, Activity, Plug } from "lucide-react";

export type MobilePanel = "dashboard" | "chat" | "connections" | "logs";

interface MobileNavProps {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  alertCount?: number;
}

const tabs: { id: MobilePanel; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Panel", Icon: LayoutDashboard },
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "connections", label: "Servicios", Icon: Plug },
  { id: "logs", label: "Logs", Icon: Activity },
];

export function MobileNav({ active, onChange, alertCount = 0 }: MobileNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-md safe-area-bottom md:hidden">
      <div className="flex items-center justify-around h-16">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full py-1 transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg",
              active === id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className="size-5" />
              {id === "dashboard" && alertCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center size-3.5 rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {alertCount > 9 ? "9+" : alertCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium leading-none">{label}</span>
            {active === id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
