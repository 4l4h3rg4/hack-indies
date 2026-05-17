"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader, type AppSection } from "@/components/layout/AppHeader";
import { MobileNav, type MobilePanel } from "@/components/layout/MobileNav";
import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { ConnectionsPanel } from "@/components/dashboard/ConnectionsPanel";
import { ConnectionsGraph } from "@/components/dashboard/ConnectionsGraph";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { AgentActivityFeed } from "@/components/agents/AgentActivityFeed";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { useChat } from "@/hooks/useChat";
import { useAgentLogs } from "@/hooks/useAgentLogs";
import { useDashboard } from "@/hooks/useDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ApiProvider } from "@/contexts/ApiContext";

export default function Home() {
  const { user, loading: authLoading, getToken } = useAuth();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!user) {
    router.replace("/login");
    return null;
  }

  return (
    <ApiProvider getToken={getToken}>
      <AuthenticatedHome />
    </ApiProvider>
  );
}

function AuthenticatedHome() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("chat");
  const [section, setSection] = useState<AppSection>("dashboard");
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  const { user } = useAuth();
  const { messages, isLoading, sendMessage, sessionId } = useChat();
  const agentLogs = useAgentLogs(sessionId);
  const { data: dashboard } = useDashboard();
  const api = useApi();

  const userInitials = (() => {
    if (!user) return "U";
    const meta = (user.user_metadata as Record<string, string> | undefined) || {};
    const name = meta.full_name || meta.name || user.email || "";
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  })();

  useEffect(() => {
    api
      .fetchProfile()
      .then((profile) => setOnboarded(profile.onboarding_completed))
      .catch(() => setOnboarded(false));
  }, [api.fetchProfile]);

  const handleOnboardingComplete = async (data: {
    companyName: string;
    selectedServices: string[];
  }) => {
    try {
      await api.updateProfile({
        onboarding_completed: true,
        company_name: data.companyName || undefined,
      });
    } catch {
      // ignore profile update errors
    }

    for (const serviceType of data.selectedServices) {
      try {
        await api.createConnection(serviceType, serviceType, {});
      } catch {
        // placeholder connections may fail silently
      }
    }

    setOnboarded(true);
  };

  if (onboarded === null) {
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

  if (!onboarded) {
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
  const isConnectionsView = section === "conexiones";

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <AppHeader active={section} onActiveChange={setSection} />

      {/* ── Mobile layout ── */}
      <div className="flex-1 flex overflow-hidden md:hidden">
        <AnimatePresence mode="wait">
          <motion.main
            key={mobilePanel}
            initial={{
              opacity: 0,
              x:
                mobilePanel === "dashboard"
                  ? -20
                  : mobilePanel === "logs"
                    ? 20
                    : 0,
            }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {mobilePanel === "dashboard" && <DashboardPanel />}
            {mobilePanel === "chat" && (
              <ChatPanel
                messages={messages}
                isLoading={isLoading}
                onSend={sendMessage}
              />
            )}
            {mobilePanel === "connections" && <ConnectionsPanel />}
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
        <aside className="w-[244px] flex-shrink-0 border-r border-border bg-card hidden md:block">
          <DashboardPanel />
        </aside>

        <section className="flex-1 flex flex-col min-w-0 bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={isConnectionsView ? "graph" : "chat"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {isConnectionsView ? (
                <ConnectionsGraph
                  connections={dashboard?.connections || []}
                  userInitials={userInitials}
                />
              ) : (
                <ChatPanel
                  messages={messages}
                  isLoading={isLoading}
                  onSend={sendMessage}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>

        <aside className="hidden lg:block w-[272px] flex-shrink-0 border-l border-border bg-card">
          <AnimatePresence mode="wait">
            <motion.div
              key={isConnectionsView ? "chat" : "activity"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {isConnectionsView ? (
                <ChatPanel
                  messages={messages}
                  isLoading={isLoading}
                  onSend={sendMessage}
                />
              ) : (
                <AgentActivityFeed logs={agentLogs} />
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}
