"use client";

import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { ChatMessage } from "@/hooks/useChat";

function getInitials(name?: string | null): string {
  if (!name) return "Tú";
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const { user } = useAuth();
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="text-[10.5px] text-muted-foreground px-3 py-1 rounded-full border border-border bg-secondary/50">
          {message.content}
        </div>
      </div>
    );
  }

  const meta = (user?.user_metadata as Record<string, string> | undefined) || {};
  const userName = meta.full_name || meta.name || user?.email || "Tú";
  const initials = getInitials(userName);

  return (
    <div
      className={cn(
        "flex gap-3 animate-slide-in-up items-start",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      {isUser ? (
        <div
          className="flex-shrink-0 size-[30px] rounded-lg flex items-center justify-center text-[11px] font-bold text-primary border border-primary/25"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary) / 0.22) 0%, hsl(var(--card)) 100%)",
          }}
        >
          {initials}
        </div>
      ) : (
        <div className="flex-shrink-0 size-[30px] rounded-lg bg-brand-gradient flex items-center justify-center shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
          <Shield className="size-[13px] text-white" strokeWidth={2.2} />
        </div>
      )}

      {/* Bubble + meta */}
      <div className={cn("max-w-[72%] flex flex-col gap-1.5", isUser && "items-end")}>
        {/* Meta (only for AI) */}
        {!isUser && (
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-bold uppercase tracking-wide text-primary text-[9.5px]">
              HackIndie CISO
            </span>
            {message.timestamp && (
              <span className="text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-[13px] leading-[1.65]",
            isUser
              ? "rounded-tr-[3px] bg-primary/10 border border-primary/20 text-foreground"
              : "rounded-tl-[3px] bg-secondary/60 border border-border text-foreground"
          )}
        >
          {message.content ? (
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>
          ) : (
            <div className="flex gap-1.5 py-1">
              <span className="typing-dot size-[5px] bg-muted-foreground/40 rounded-full" />
              <span className="typing-dot size-[5px] bg-muted-foreground/40 rounded-full" />
              <span className="typing-dot size-[5px] bg-muted-foreground/40 rounded-full" />
            </div>
          )}
          {message.isStreaming && message.content && (
            <span className="inline-block w-[2px] h-4 bg-primary ml-0.5 cursor-blink rounded-sm align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
