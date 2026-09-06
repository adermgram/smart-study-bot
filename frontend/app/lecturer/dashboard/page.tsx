"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { BarRow } from "@/components/ui/BarRow";
import { StatTile } from "@/components/ui/StatTile";

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
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [tags, setTags] = useState<TopicTag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "lecturer")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "lecturer") {
      apiFetch<Course[]>("/courses?mine=true").then((cs) => {
        setCourses(cs);
        if (cs.length > 0) setCourseId(cs[0].course_id);
      });
    }
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    setTagsLoading(true);
    apiFetch<TopicTag[]>(`/courses/${courseId}/topic-tags`)
      .then(setTags)
      .catch(() => setTags([]))
      .finally(() => setTagsLoading(false));
  }, [courseId]);

  async function onRefresh() {
    if (!courseId) return;
    setError(null);
    setRefreshing(true);
    try {
      const fresh = await apiFetch<TopicTag[]>(`/courses/${courseId}/topic-tags/refresh`, { method: "POST" });
      setTags(fresh);
      toast("Insights refreshed");
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

  const maxQuestionCount = Math.max(1, ...questionTags.map((t) => t.question_count ?? 0));

  // Status color + word travel together -- a colorblind reader shouldn't need the
  // hue alone to know a topic needs attention (dataviz: status is never color-only).
  function quizSeverity(pct: number) {
    if (pct < 50) return { fill: "bg-danger", track: "bg-danger/15", text: "text-danger", word: "Struggling" };
    if (pct < 75) return { fill: "bg-warning", track: "bg-warning/15", text: "text-warning", word: "Mixed" };
    return { fill: "bg-success", track: "bg-success/15", text: "text-success", word: "Solid" };
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Topic-tag dashboard</h1>
          <p className="mt-1 text-sm text-muted">
            Aggregated, anonymized -- no individual student content is shown here.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing || !courseId}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10 hover:text-accent disabled:opacity-50"
        >
          {refreshing && <Spinner className="h-3.5 w-3.5" />}
          {refreshing ? "Refreshing..." : "Refresh now"}
        </button>
      </div>

      <div className="mt-6 space-y-1">
        <label className="text-sm font-medium" htmlFor="course">Course</label>
        <select
          id="course"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40"
        >
          {courses.map((c) => (
            <option key={c.course_id} value={c.course_id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="mt-8">
        <h2 className="text-base font-semibold">Most-asked topics</h2>
        <p className="text-xs text-muted">Students are curious about these -- consider more examples or a follow-up note.</p>
        {tagsLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : questionTags.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No questions recorded yet for the current period.
          </p>
        ) : questionTags.length === 1 ? (
          <div className="mt-3">
            <StatTile
              label={questionTags[0].topic_label}
              value={String(questionTags[0].question_count)}
              caption={`question${questionTags[0].question_count === 1 ? "" : "s"} this period`}
            />
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {questionTags.map((t) => (
              <li key={t.tag_id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <BarRow
                  label={t.topic_label}
                  valueLabel={`${t.question_count} question${t.question_count === 1 ? "" : "s"}`}
                  percent={((t.question_count ?? 0) / maxQuestionCount) * 100}
                />
                <p className="mt-2 text-xs text-muted">
                  {new Date(t.period_start).toLocaleDateString()} – {new Date(t.period_end).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-semibold">Weakest quiz topics</h2>
        <p className="text-xs text-muted">Lowest average self-assessment score -- these may need reteaching, not just more material.</p>
        {tagsLoading ? (
          <div className="mt-3 space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
          </div>
        ) : quizTags.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            No quiz attempts recorded yet for the current period.
          </p>
        ) : quizTags.length === 1 ? (
          (() => {
            const t = quizTags[0];
            const s = quizSeverity(t.avg_quiz_score_pct ?? 0);
            return (
              <div className="mt-3">
                <StatTile
                  label={`${t.topic_label} -- ${s.word}`}
                  value={`${t.avg_quiz_score_pct?.toFixed(0)}%`}
                  valueClassName={s.text}
                  caption={`${t.quiz_attempt_count} attempt${t.quiz_attempt_count === 1 ? "" : "s"} this period`}
                />
              </div>
            );
          })()
        ) : (
          <ul className="mt-3 space-y-2">
            {quizTags.map((t) => {
              const s = quizSeverity(t.avg_quiz_score_pct ?? 0);
              return (
                <li key={t.tag_id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <BarRow
                    label={t.topic_label}
                    valueLabel={`${t.avg_quiz_score_pct?.toFixed(0)}% avg (${t.quiz_attempt_count} attempt${t.quiz_attempt_count === 1 ? "" : "s"})`}
                    percent={t.avg_quiz_score_pct ?? 0}
                    fillClassName={s.fill}
                    trackClassName={s.track}
                    statusWord={s.word}
                  />
                  <p className="mt-2 text-xs text-muted">
                    {new Date(t.period_start).toLocaleDateString()} – {new Date(t.period_end).toLocaleDateString()}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
