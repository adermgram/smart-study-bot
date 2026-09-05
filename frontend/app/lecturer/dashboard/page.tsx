"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

interface TopicTag {
  tag_id: string;
  topic_label: string;
  question_count: number;
  period_start: string;
  period_end: string;
}

export default function LecturerDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [tags, setTags] = useState<TopicTag[]>([]);

  useEffect(() => {
    if (!loading && (!user || user.role !== "lecturer")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "lecturer") {
      apiFetch<Course[]>("/courses").then((cs) => {
        setCourses(cs);
        if (cs.length > 0) setCourseId(cs[0].course_id);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    apiFetch<TopicTag[]>(`/courses/${courseId}/topic-tags`).then(setTags).catch(() => setTags([]));
  }, [courseId]);

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Topic-tag dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Aggregated, anonymized -- generated periodically from student questions and quiz results.
        No individual student content is shown here.
      </p>

      <div className="mt-6 space-y-1">
        <label className="text-sm font-medium" htmlFor="course">Course</label>
        <select
          id="course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full rounded border px-3 py-2"
        >
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-6 space-y-2">
        {tags.map((t) => (
          <li key={t.tag_id} className="rounded border p-3 text-sm">
            <div className="flex items-center justify-between">
              <strong>{t.topic_label}</strong>
              <span>{t.question_count} question{t.question_count === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(t.period_start).toLocaleDateString()} – {new Date(t.period_end).toLocaleDateString()}
            </p>
          </li>
        ))}
        {tags.length === 0 && (
          <li className="text-sm text-gray-500">
            No topic tags yet -- these are generated periodically once students have activity in this course.
          </li>
        )}
      </ul>
    </main>
  );
}
