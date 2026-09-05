"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

export default function CoursesPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) apiFetch<Course[]>("/courses").then(setCourses).catch(() => setCourses([]));
  }, [user]);

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pilot courses</h1>
        <button onClick={logout} className="text-sm underline">
          Log out
        </button>
      </div>

      {user.role === "lecturer" && (
        <div className="mb-6 flex gap-4 text-sm">
          <Link href="/lecturer/upload" className="underline">Upload material</Link>
          <Link href="/lecturer/dashboard" className="underline">Topic dashboard</Link>
        </div>
      )}
      {user.role === "student" && (
        <div className="mb-6 text-sm">
          <Link href="/history" className="underline">My conversation history</Link>
        </div>
      )}

      <ul className="space-y-2">
        {courses.map((c) => (
          <li key={c.course_id} className="flex items-center justify-between rounded border p-4">
            <span>
              <strong>{c.code}</strong> — {c.title}
            </span>
            {user.role === "student" && (
              <span className="flex gap-3 text-sm">
                <Link href={`/chat/${c.course_id}`} className="underline">Ask a question</Link>
                <Link href={`/quiz/${c.course_id}`} className="underline">Take a quiz</Link>
              </span>
            )}
          </li>
        ))}
        {courses.length === 0 && <li className="text-sm text-gray-500">No courses yet.</li>}
      </ul>
    </main>
  );
}
