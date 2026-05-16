"use client";
import { Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useChat";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-gray-800/60 text-gray-400 text-xs px-3 py-1.5 rounded-full border border-gray-700/50">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-3 mb-4 animate-fade-in", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser ? "bg-brand-600" : "bg-gray-700"
        )}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Shield size={16} className="text-brand-400" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-brand-600 text-white rounded-tr-sm"
            : "bg-gray-800/80 text-gray-100 rounded-tl-sm border border-gray-700/50"
        )}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="flex gap-1 py-1">
            <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
            <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
            <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
          </div>
        )}
        {message.isStreaming && message.content && (
          <span className="inline-block w-1.5 h-4 bg-brand-400 ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}
