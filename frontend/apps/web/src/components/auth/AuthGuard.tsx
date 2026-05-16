"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
        <Skeleton className="size-16 rounded-2xl" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
