"use client";

import { useRef, useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SuggestionChips } from "./SuggestionChips";
import type { ChatMessage } from "@/hooks/useChat";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
}

const DEFAULT_SUGGESTIONS = [
  "¿Qué tan seguro está mi negocio?",
  "Conecta mi Supabase para auditar",
  "Necesito revisar mi configuración",
];

const ACTIVE_CHIPS = [
  "Ver todos los CVEs",
  "Generar reporte",
  "¿Cómo parcheo esto?",
];

export function ChatPanel({ messages, isLoading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Scroll only the messages container, not the page
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ─── Header ─── */}
      <div className="flex items-center gap-3 h-12 px-5 border-b border-border bg-card/95 backdrop-blur-md flex-shrink-0">
        <div className="size-[30px] rounded-md bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.4)]">
          <Shield className="size-[13px] text-white" strokeWidth={2.2} />
        </div>
        <div className="leading-none">
          <h2 className="text-[13.5px] font-semibold tracking-tight">
            CISO Virtual
          </h2>
          <p className="text-[10.5px] text-muted-foreground mt-[3px]">
            {isLoading ? "Escribiendo…" : "Sesión activa"}
          </p>
        </div>
        <div className="flex-1" />
        <span className="text-[10.5px] font-medium text-muted-foreground px-2.5 py-1 rounded-md border border-border">
          Gemini 2.5 Flash
        </span>
      </div>

      {/* ─── Messages (own scroll container) ─── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 scrollbar-thin"
      >
        <div className="px-7 py-6">
          {!hasMessages ? (
            <div className="flex flex-col items-center justify-center min-h-[340px] text-center">
              <div className="size-14 rounded-xl bg-brand-gradient flex items-center justify-center mb-4 shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.5)]">
                <Shield className="size-6 text-white" strokeWidth={2.2} />
              </div>
              <h3 className="text-base font-semibold mb-1.5">
                HackIndie CISO Virtual
              </h3>
              <p className="text-[13px] text-muted-foreground max-w-xs mb-5 leading-relaxed">
                Tu director de seguridad virtual. Hazme cualquier consulta sobre
                la postura de seguridad de tu PyME.
              </p>
              <SuggestionChips
                suggestions={DEFAULT_SUGGESTIONS}
                onSelect={onSend}
                disabled={isLoading}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-[18px]">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Suggested chips ─── */}
      {hasMessages && (
        <div className="px-7 pb-3 flex gap-1.5 flex-wrap flex-shrink-0">
          {ACTIVE_CHIPS.map((c) => (
            <button
              key={c}
              onClick={() => onSend(c)}
              disabled={isLoading}
              className="text-[11.5px] font-medium px-3 py-1.5 rounded-md border border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ─── Input ─── */}
      <div className="flex-shrink-0">
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
