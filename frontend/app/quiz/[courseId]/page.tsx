"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

interface QuizQuestion {
  question: string;
  options: string[];
}

interface QuizResult {
  question: string;
  options: string[];
  correct_index: number;
  chosen_index: number;
  correct: boolean;
  explanation: string | null;
}

interface PastAttempt {
  attempt_id: string;
  course_id: string;
  topic: string;
  score: number | null;
  total_questions: number;
  attempted_at: string;
}

// Below this fraction, nudge the student toward asking about the topic in chat instead
// of just showing the score and moving on.
const WEAK_SCORE_THRESHOLD = 0.6;

export default function QuizPage({ params }: PageProps<"/quiz/[courseId]">) {
  const { courseId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PastAttempt[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ score: number; total: number; results: QuizResult[] } | null>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    apiFetch<Course[]>("/courses").then((cs) => setCourse(cs.find((c) => c.course_id === courseId) ?? null));
  }, [courseId]);

  useEffect(() => {
    if (user?.role === "student") {
      setHistoryLoading(true);
      apiFetch<PastAttempt[]>("/users/me/quiz-results")
        .then((results) => setHistory(results.filter((r) => r.course_id === courseId)))
        .finally(() => setHistoryLoading(false));
    }
  }, [user, courseId]);

  async function onGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setError(null);
    setOutcome(null);
    setGenerating(true);
    try {
      const res = await apiFetch<{ attempt_id: string; questions: QuizQuestion[] }>(`/courses/${courseId}/quiz`, {
        method: "POST",
        body: JSON.stringify({ topic, num_questions: 5 }),
      });
      setAttemptId(res.attempt_id);
      setQuestions(res.questions);
      setAnswers(new Array(res.questions.length).fill(null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a quiz");
    } finally {
      setGenerating(false);
    }
  }

  async function onSubmit() {
    if (!attemptId || answers.some((a) => a === null)) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ score: number; total: number; results: QuizResult[] }>(
        `/quiz/${attemptId}/submit`,
        { method: "POST", body: JSON.stringify({ answers }) }
      );
      setOutcome(res);
      setHistory((h) => [
        {
          attempt_id: attemptId,
          course_id: courseId,
          topic,
          score: res.score,
          total_questions: res.total,
          attempted_at: new Date().toISOString(),
        },
        ...h,
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the quiz");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setAttemptId(null);
    setQuestions([]);
    setAnswers([]);
    setOutcome(null);
    setTopic("");
  }

  if (loading || !user) return null;

  const isWeak = outcome !== null && outcome.total > 0 && outcome.score / outcome.total < WEAK_SCORE_THRESHOLD;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {course ? `${course.code} — Self-assessment` : "Self-assessment"}
      </h1>

      {!attemptId && (
        <form onSubmit={onGenerate} className="mt-6 flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic, e.g. Arrays and Linked Lists"
            disabled={generating}
            className="flex-1 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={generating || !topic.trim()}
            className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {generating && <Spinner className="h-4 w-4" />}
            {generating ? "Generating..." : "Generate quiz"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {attemptId && !outcome && (
        <div className="mt-6 space-y-4">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="font-medium">{qi + 1}. {q.question}</p>
              <div className="mt-3 space-y-1.5">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors ${
                        selected ? "border-accent bg-accent/10" : "border-border hover:bg-background"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q${qi}`}
                        checked={selected}
                        onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))}
                        className="accent-[var(--accent)]"
                      />
                      {opt}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            onClick={onSubmit}
            disabled={submitting || answers.some((a) => a === null)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting ? "Submitting..." : "Submit answers"}
          </button>
        </div>
      )}

      {outcome && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
            <p className="text-3xl font-semibold tracking-tight">
              {outcome.score}<span className="text-muted"> / {outcome.total}</span>
            </p>
            <p className="mt-1 text-sm text-muted">on {topic}</p>
          </div>

          {isWeak && (
            <div className="rounded-xl border border-warning-border bg-warning-bg p-3 text-sm text-warning">
              This score was on the low side for <strong>{topic}</strong>.{" "}
              <Link
                href={`/chat/${courseId}?q=${encodeURIComponent(`Can you help me understand ${topic}?`)}`}
                className="font-medium underline"
              >
                Ask about it in chat
              </Link>
              .
            </div>
          )}

          {outcome.results.map((r, i) => (
            <div
              key={i}
              className={`rounded-2xl border p-4 shadow-sm ${r.correct ? "border-success-border bg-success-bg" : "border-danger-border bg-danger-bg"}`}
            >
              <p className="font-medium">{i + 1}. {r.question}</p>
              <p className={`mt-1.5 text-sm font-medium ${r.correct ? "text-success" : "text-danger"}`}>
                Your answer: {r.options[r.chosen_index]} {r.correct ? "✓" : "✗"}
              </p>
              {!r.correct && (
                <p className="text-sm text-muted">Correct answer: {r.options[r.correct_index]}</p>
              )}
              {r.explanation && <p className="mt-1.5 text-sm text-muted">{r.explanation}</p>}
            </div>
          ))}
          <button
            onClick={reset}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-border/30"
          >
            Take another quiz
          </button>
        </div>
      )}

      {!attemptId && (
        <section className="mt-10">
          <h2 className="text-base font-semibold">Past attempts</h2>
          <ul className="mt-3 space-y-2">
            {historyLoading ? (
              [0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
            ) : (
              <>
                {history.map((h) => (
                  <li key={h.attempt_id} className="rounded-2xl border border-border bg-surface p-3.5 text-sm shadow-sm">
                    <div className="flex items-center justify-between">
                      <strong className="font-semibold">{h.topic}</strong>
                      <span className="text-muted">{h.score} / {h.total_questions}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted">{new Date(h.attempted_at).toLocaleString()}</p>
                  </li>
                ))}
                {history.length === 0 && (
                  <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                    No past attempts for this course yet.
                  </li>
                )}
              </>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
