"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

export default function CoursesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      setCoursesLoading(true);
      apiFetch<Course[]>("/courses")
        .then(setCourses)
        .catch(() => setCourses([]))
        .finally(() => setCoursesLoading(false));
    }
  }, [user]);

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Pilot courses</h1>

      {coursesLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {courses.map((c) => (
            <li
              key={c.course_id}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="text-sm">
                <strong className="font-semibold">{c.code}</strong>
                <span className="text-muted"> — {c.title}</span>
              </span>
              {user.role === "student" && (
                <span className="flex gap-2 text-sm">
                  <Link
                    href={`/chat/${c.course_id}`}
                    className="rounded-lg px-2.5 py-1 font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    Ask a question
                  </Link>
                  <Link
                    href={`/quiz/${c.course_id}`}
                    className="rounded-lg px-2.5 py-1 font-medium text-accent transition-colors hover:bg-accent/10"
                  >
                    Take a quiz
                  </Link>
                </span>
              )}
            </li>
          ))}
          {courses.length === 0 && (
            <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No courses yet.
            </li>
          )}
        </ul>
      )}
    </main>
  );
}
