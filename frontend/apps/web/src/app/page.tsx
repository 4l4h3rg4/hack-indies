"use client";
import { useState } from "react";
import { Shield } from "lucide-react";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { AgentConsole } from "@/components/agents/AgentConsole";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useChat } from "@/hooks/useChat";

export default function Home() {
  const [mobilePanel, setMobilePanel] = useState<"chat" | "dashboard" | "logs">("chat");
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const agentLogs = useAgentLogs(sessionId);

  const chatView = (
    <ChatContainer messages={messages} isLoading={isLoading} onSend={sendMessage} />
  );

  const dashboardView = (
    <div className="flex-1 overflow-y-auto">
      <DashboardSidebar />
    </div>
  );

  const logsView = (
    <div className="flex-1">
      <AgentConsole logs={agentLogs} />
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-brand-400" />
          <span className="text-sm font-bold text-white tracking-tight">
            Hack<span className="text-brand-400">Indie</span>
          </span>
          <span className="text-[10px] text-gray-600 hidden sm:inline">CISO Virtual</span>
        </div>

        {/* Mobile panel switcher */}
        <div className="flex gap-1 sm:hidden">
          {[
            { id: "dashboard", label: "Panel" },
            { id: "chat", label: "Chat" },
            { id: "logs", label: "Logs" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobilePanel(tab.id as typeof mobilePanel)}
              className={`px-3 py-1 text-[11px] rounded-lg transition-colors ${
                mobilePanel === tab.id
                  ? "bg-brand-600/20 text-brand-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs text-gray-500">Sistema activo</span>
        </div>
      </header>

      {/* Desktop layout: 3 panels */}
      <main className="hidden sm:flex flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 h-full">{dashboardView}</aside>
        <section className="flex-1 flex flex-col min-w-0 h-full">{chatView}</section>
        <aside className="hidden lg:block w-72 flex-shrink-0 h-full border-l border-gray-800 bg-gray-900/30">
          {logsView}
        </aside>
      </main>

      {/* Mobile layout: single panel */}
      <div className="sm:hidden flex-1 flex overflow-hidden">
        {mobilePanel === "dashboard" && dashboardView}
        {mobilePanel === "chat" && chatView}
        {mobilePanel === "logs" && logsView}
      </div>
    </div>
  );
}
