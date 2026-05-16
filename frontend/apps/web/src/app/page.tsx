"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobileNav, type MobilePanel } from "@/components/layout/MobileNav";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentActivityFeed } from "@/components/agents/AgentActivityFeed";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useChat } from "@/hooks/useChat";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { setTokenProvider } from "@/lib/api";

const ONBOARDING_KEY = "hackindie-onboarding-completed";

export default function Home() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const [onboarded, setOnboarded] = useState(true);
  const [mounted, setMounted] = useState(false);

  const { user, loading: authLoading, getToken } = useAuth();
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const agentLogs = useAgentLogs(sessionId);
  const { data: dashboard } = useDashboard();

  // Wire up token provider for API calls
  useEffect(() => {
    setTokenProvider(getToken);
  }, [getToken]);

  useEffect(() => {
    setMounted(true);
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) setOnboarded(false);
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOnboarded(true);
  };

  // Auth loading state
  if (!mounted || authLoading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AppHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center size-16 rounded-2xl bg-primary/10">
              <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Cargando HackIndie...</p>
          </div>
        </main>
      </div>
    );
  }

  // Show onboarding if not completed (only for authenticated users)
  if (user && !onboarded) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <AppHeader />
        <main className="flex-1 overflow-hidden">
          <OnboardingWizard onComplete={handleOnboardingComplete} />
        </main>
      </div>
    );
  }

  const alertCount = dashboard?.total_alerts || 0;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppHeader />

      {/* ── Mobile layout ── */}
      <div className="flex-1 flex overflow-hidden md:hidden">
        <AnimatePresence mode="wait">
          <motion.main
            key={mobilePanel}
            initial={{ opacity: 0, x: mobilePanel === "dashboard" ? -20 : mobilePanel === "logs" ? 20 : 0 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {mobilePanel === "dashboard" && <DashboardPanel />}
            {mobilePanel === "chat" && (
              <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
            )}
            {mobilePanel === "connections" && (
              <div className="flex-1 flex items-center justify-center p-4">
                <DashboardPanel />
              </div>
            )}
            {mobilePanel === "logs" && (
              <div className="flex-1">
                <AgentActivityFeed logs={agentLogs} />
              </div>
            )}
          </motion.main>
        </AnimatePresence>

        <MobileNav
          active={mobilePanel}
          onChange={setMobilePanel}
          alertCount={alertCount}
        />
      </div>

      {/* ── Desktop layout (≥768px) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <aside className="w-80 flex-shrink-0 border-r bg-card/30 hidden md:block">
          <DashboardPanel />
        </aside>
        <section className="flex-1 flex flex-col min-w-0">
          <ChatPanel messages={messages} isLoading={isLoading} onSend={sendMessage} />
        </section>
        <aside className="hidden lg:block w-72 flex-shrink-0 border-l bg-card/30">
          <AgentActivityFeed logs={agentLogs} />
        </aside>
      </div>
    </div>
  );
}
