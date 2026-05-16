"use client";

import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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

  return (
    <div className="border-t bg-background/80 backdrop-blur-md p-3">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta de seguridad..."
          rows={1}
          disabled={isLoading}
          className={cn(
            "min-h-10 max-h-32 resize-none text-sm",
            "bg-muted/50 border-muted-foreground/20"
          )}
        />
        <Button
          size="icon"
          onClick={onSend}
          disabled={isLoading || !value.trim()}
          className="size-10 flex-shrink-0"
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          <span className="sr-only">Enviar</span>
        </Button>
      </div>
    </div>
  );
}
