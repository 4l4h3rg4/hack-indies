"use client";

import { createContext, useContext, type ReactNode } from "react";

type GetTokenFn = () => Promise<string | null>;

const ApiContext = createContext<GetTokenFn>(() => Promise.resolve(null));

export function ApiProvider({
  children,
  getToken,
}: {
  children: ReactNode;
  getToken: GetTokenFn;
}) {
  return (
    <ApiContext.Provider value={getToken}>{children}</ApiContext.Provider>
  );
}

export function useGetToken(): GetTokenFn {
  return useContext(ApiContext);
}
