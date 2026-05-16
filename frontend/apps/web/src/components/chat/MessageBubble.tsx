"use client";

import { Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useChat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-muted/60 text-muted-foreground text-xs px-3 py-1 rounded-full border">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-2.5 mb-4 animate-slide-in-up",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 size-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground border"
        )}
      >
        {isUser ? <User className="size-4" /> : <Shield className="size-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-card text-card-foreground rounded-tl-md border shadow-sm"
        )}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="flex gap-1 py-1.5">
            <span className="typing-dot size-1.5 bg-muted-foreground/50 rounded-full" />
            <span className="typing-dot size-1.5 bg-muted-foreground/50 rounded-full" />
            <span className="typing-dot size-1.5 bg-muted-foreground/50 rounded-full" />
          </div>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1 h-4 bg-primary ml-0.5 cursor-blink rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}
