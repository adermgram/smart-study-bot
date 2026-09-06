"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40";

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    department: "",
    password: "",
    role: "student" as "student" | "lecturer",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Register</h1>
        <p className="mt-1 text-sm text-muted">Create your account.</p>

        {error && (
          <p className="mt-4 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="name">Full name</label>
            <input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="email">Institutional email</label>
            <input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="department">Department</label>
            <input id="department" required value={form.department} onChange={(e) => update("department", e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <input id="password" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="role">Role</label>
            <select id="role" value={form.role} onChange={(e) => update("role", e.target.value as "student" | "lecturer")} className={inputClass}>
              <option value="student">Student</option>
              <option value="lecturer">Lecturer</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting && <Spinner className="h-4 w-4" />}
          {submitting ? "Creating account..." : "Register"}
        </button>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account? <Link href="/login" className="font-medium text-accent hover:text-accent-hover">Log in</Link>
        </p>
      </form>
    </main>
  );
}
