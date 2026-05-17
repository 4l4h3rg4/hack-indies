"use client";

import { Send, Loader2, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
}

export function ChatInput({ value, onChange, onSend, isLoading }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const canSend = !isLoading && value.trim().length > 0;

  return (
    <div className="border-t border-border bg-card/95 backdrop-blur-md px-5 py-3.5">
      <div
        className={cn(
          "flex items-center gap-2 bg-secondary/50 border border-border rounded-[11px] pl-4 pr-[5px] py-[5px]",
          "focus-within:border-primary/40 focus-within:bg-secondary transition-colors"
        )}
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Preguntá a tu CISO Virtual…"
          disabled={isLoading}
          className="flex-1 bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-muted-foreground/70 h-6"
        />

        <button
          type="button"
          className="size-7 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-accent transition-colors"
          title="Adjuntar"
        >
          <Paperclip className="size-[13px]" strokeWidth={1.7} />
        </button>

        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          className={cn(
            "size-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0",
            canSend
              ? "bg-primary text-white hover:opacity-90"
              : "bg-secondary text-muted-foreground/40 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="size-[13px] animate-spin" />
          ) : (
            <Send className="size-[13px]" strokeWidth={2.2} />
          )}
          <span className="sr-only">Enviar</span>
        </button>
      </div>
    </div>
  );
}
