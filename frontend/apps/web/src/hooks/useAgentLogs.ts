"use client";
import { useEffect, useRef, useState } from "react";
import { AgentLogEntry, fetchAgentLogsStream } from "@/lib/api";

export function useAgentLogs(sessionId: string | null) {
  const [logs, setLogs] = useState<AgentLogEntry[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const startStream = async () => {
      try {
        const stream = await fetchAgentLogsStream(sessionId);
        readerRef.current = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await readerRef.current.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.agent_name) {
                  setLogs((prev) => [...prev.slice(-99), data]);
                }
              } catch {}
            }
          }
        }
      } catch (err) {
        console.error("Agent log stream error:", err);
      }
    };

    startStream();

    return () => {
      if (readerRef.current) {
        readerRef.current.cancel();
      }
    };
  }, [sessionId]);

  return logs;
}
