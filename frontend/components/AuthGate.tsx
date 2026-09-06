"use client";

import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/Spinner";

/** Every page used to `return null` while the initial /auth/me check was in flight,
 * so every navigation showed a beat of blank white before content popped in. Gating
 * centrally here fixes that in one place instead of touching every page. */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="h-6 w-6 text-accent" />
      </div>
    );
  }

  return <>{children}</>;
}
