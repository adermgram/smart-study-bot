"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Log in</h1>
        <p className="mt-1 text-sm text-muted">Welcome back.</p>

        {error && (
          <p className="mt-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Logging in..." : "Log in"}
        </button>
        <p className="mt-4 text-center text-sm text-muted">
          No account? <Link href="/register" className="font-medium text-accent hover:text-accent-hover">Register</Link>
        </p>
      </form>
    </main>
  );
}
