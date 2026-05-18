"use client";

import { useMemo } from "react";
import { useGetToken } from "@/contexts/ApiContext";
import * as rawApi from "@/lib/api";

export function useApi() {
  const getToken = useGetToken();

  return useMemo(
    () => ({
      fetchDashboard: () =>
        getToken().then((t) => rawApi.fetchDashboard(t)),

      fetchProfile: () => getToken().then((t) => rawApi.fetchProfile(t)),

      updateProfile: (fields: Parameters<typeof rawApi.updateProfile>[1]) =>
        getToken().then((t) => rawApi.updateProfile(t, fields)),

      createConnection: (
        serviceType: string,
        serviceName: string,
        credentials: Record<string, string>
      ) =>
        getToken().then((t) =>
          rawApi.createConnection(t, serviceType, serviceName, credentials)
        ),

      deleteConnection: (connectionId: string) =>
        getToken().then((t) => rawApi.deleteConnection(t, connectionId)),

      createChatStream: (message: string, sessionId: string) =>
        getToken().then((t) =>
          rawApi.createChatStream(t, message, sessionId)
        ),

      fetchAgentLogsStream: (sessionId: string) =>
        getToken().then((t) => rawApi.fetchAgentLogsStream(t, sessionId)),

      fetchConnections: () =>
        getToken().then((t) => rawApi.fetchConnections(t)),

      fetchAlerts: () => getToken().then((t) => rawApi.fetchAlerts(t)),

      resolveAlert: (alertId: string) =>
        getToken().then((t) => rawApi.resolveAlert(t, alertId)),

      reauditAlert: (alertId: string) =>
        getToken().then((t) => rawApi.reauditAlert(t, alertId)),

      dismissAlert: (alertId: string) =>
        getToken().then((t) => rawApi.dismissAlert(t, alertId)),

      testConnection: (
        serviceType: string,
        credentials: Record<string, string>
      ) =>
        getToken().then((t) =>
          rawApi.testConnection(t, serviceType, credentials)
        ),
    }),
    [getToken]
  );
}
