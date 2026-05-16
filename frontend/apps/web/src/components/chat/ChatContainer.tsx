"use client";
import { useRef, useEffect, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "@/hooks/useChat";

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
}

export function ChatContainer({ messages, isLoading, onSend }: Props) {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <ShieldCheck size={20} className="text-brand-400" />
        <h2 className="text-sm font-semibold text-gray-200">CISO Virtual</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
            <ShieldCheck size={48} className="text-gray-700 mb-4" />
            <h3 className="text-lg font-medium text-gray-400 mb-2">
              HackIndie CISO Virtual
            </h3>
            <p className="text-sm max-w-md">
              Soy tu director de seguridad virtual. Cuéntame sobre tu infraestructura
              o hazme cualquier consulta de ciberseguridad para tu PyME.
            </p>
            <div className="flex gap-2 mt-4 flex-wrap justify-center">
              {[
                "¿Qué tan seguro está mi negocio?",
                "Conecta mi Supabase para auditar",
                "Necesito revisar mi configuración",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => onSend(suggestion)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 transition-colors border border-gray-700/50"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-800 p-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe tu consulta de seguridad..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-gray-800 text-gray-100 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/50 placeholder-gray-500 disabled:opacity-50 border border-gray-700/50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-4 flex items-center justify-center transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
