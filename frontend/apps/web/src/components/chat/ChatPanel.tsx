"use client";

import { useRef, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export function ChatPanel({ messages, isLoading, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <div className="flex items-center justify-center size-7 rounded-full bg-primary/10">
          <ShieldCheck className="size-3.5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">CISO Virtual</h2>
          <p className="text-[10px] text-muted-foreground">
            {isLoading ? "Escribiendo..." : "En línea"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10 mb-4">
                <ShieldCheck className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-1.5">HackIndie CISO Virtual</h3>
              <p className="text-sm text-muted-foreground max-w-xs mb-5">
                Soy tu director de seguridad virtual. Cuéntame sobre tu infraestructura
                o hazme cualquier consulta de ciberseguridad para tu PyME.
              </p>
              <SuggestionChips
                suggestions={DEFAULT_SUGGESTIONS}
                onSelect={onSend}
                disabled={isLoading}
              />
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isLoading={isLoading}
      />
    </div>
  );
}
