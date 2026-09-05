"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

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
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Register</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="name">Full name</label>
          <input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">Institutional email</label>
          <input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="department">Department</label>
          <input id="department" required value={form.department} onChange={(e) => update("department", e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">Password</label>
          <input id="password" type="password" required value={form.password} onChange={(e) => update("password", e.target.value)} className="w-full rounded border px-3 py-2" />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="role">Role</label>
          <select id="role" value={form.role} onChange={(e) => update("role", e.target.value as "student" | "lecturer")} className="w-full rounded border px-3 py-2">
            <option value="student">Student</option>
            <option value="lecturer">Lecturer</option>
          </select>
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded bg-black py-2 text-white disabled:opacity-50">
          {submitting ? "Creating account..." : "Register"}
        </button>
        <p className="text-sm">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </form>
    </main>
  );
}
