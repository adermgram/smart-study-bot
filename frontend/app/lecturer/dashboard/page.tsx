"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

interface TopicTag {
  tag_id: string;
  topic_label: string;
  source: "questions" | "quiz";
  question_count: number | null;
  avg_quiz_score_pct: number | null;
  quiz_attempt_count: number | null;
  period_start: string;
  period_end: string;
}

export default function LecturerDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [tags, setTags] = useState<TopicTag[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function onRefresh() {
    if (!courseId) return;
    setError(null);
    setRefreshing(true);
    try {
      const fresh = await apiFetch<TopicTag[]>(`/courses/${courseId}/topic-tags/refresh`, { method: "POST" });
      setTags(fresh);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not refresh insights");
    } finally {
      setRefreshing(false);
    }
  }

  // Most recent period per source, so the two sections show this run's numbers rather
  // than a flat mix of every refresh ever done.
  const latestPeriodEnd = (source: TopicTag["source"]) =>
    tags.filter((t) => t.source === source).reduce((max, t) => (t.period_end > max ? t.period_end : max), "");

  const questionTags = tags
    .filter((t) => t.source === "questions" && t.period_end === latestPeriodEnd("questions"))
    .sort((a, b) => (b.question_count ?? 0) - (a.question_count ?? 0));

  const quizTags = tags
    .filter((t) => t.source === "quiz" && t.period_end === latestPeriodEnd("quiz"))
    .sort((a, b) => (a.avg_quiz_score_pct ?? 100) - (b.avg_quiz_score_pct ?? 100));

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Topic-tag dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Aggregated, anonymized -- no individual student content is shown here.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing || !courseId}
          className="whitespace-nowrap rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

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

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <section className="mt-8">
        <h2 className="text-lg font-medium">Most-asked topics</h2>
        <p className="text-xs text-gray-500">Students are curious about these -- consider more examples or a follow-up note.</p>
        <ul className="mt-2 space-y-2">
          {questionTags.map((t) => (
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
          {questionTags.length === 0 && (
            <li className="text-sm text-gray-500">No questions recorded yet for the current period.</li>
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Weakest quiz topics</h2>
        <p className="text-xs text-gray-500">Lowest average self-assessment score -- these may need reteaching, not just more material.</p>
        <ul className="mt-2 space-y-2">
          {quizTags.map((t) => (
            <li key={t.tag_id} className="rounded border p-3 text-sm">
              <div className="flex items-center justify-between">
                <strong>{t.topic_label}</strong>
                <span>
                  {t.avg_quiz_score_pct?.toFixed(0)}% avg ({t.quiz_attempt_count} attempt{t.quiz_attempt_count === 1 ? "" : "s"})
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {new Date(t.period_start).toLocaleDateString()} – {new Date(t.period_end).toLocaleDateString()}
              </p>
            </li>
          ))}
          {quizTags.length === 0 && (
            <li className="text-sm text-gray-500">No quiz attempts recorded yet for the current period.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
