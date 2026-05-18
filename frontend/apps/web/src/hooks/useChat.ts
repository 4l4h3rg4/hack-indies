"use client";
import { useCallback, useRef, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { generateId } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface GraphActionProposal {
  event_type: "graph_action_proposal";
  action: string;
  connection_id: string;
  label: string;
  message: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isLoadingRef = useRef(false);
  const [pendingGraphAction, setPendingGraphAction] = useState<GraphActionProposal | null>(null);
  const sessionIdRef = useRef(generateId());
  const abortRef = useRef<AbortController | null>(null);
  const api = useApi();

  isLoadingRef.current = isLoading;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoadingRef.current) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const stream = await api.createChatStream(
          text,
          sessionIdRef.current
        );
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.event_type === "text" && data.content) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content + data.content,
                      };
                    }
                    return updated;
                  });
                } else if (data.event_type === "graph_action_proposal") {
                  setPendingGraphAction(data);
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("Chat stream error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content:
                last.content ||
                "Error: No se pudo procesar tu mensaje. Intenta de nuevo.",
              isStreaming: false,
            };
          }
          return updated;
        });
      } finally {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant") {
            updated[updated.length - 1] = { ...last, isStreaming: false };
          }
          return updated;
        });
        setIsLoading(false);
      }
    },
    [api.createChatStream]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = generateId();
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    sessionId: sessionIdRef.current,
    pendingGraphAction,
    setPendingGraphAction,
  };
}
