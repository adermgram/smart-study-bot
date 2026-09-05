"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

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
}

export default function QuizPage({ params }: PageProps<"/quiz/[courseId]">) {
  const { courseId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [course, setCourse] = useState<Course | null>(null);
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">
        {course ? `${course.code} — Self-assessment` : "Self-assessment"}
      </h1>

      {!attemptId && (
        <form onSubmit={onGenerate} className="mt-6 flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Topic, e.g. Arrays and Linked Lists"
            disabled={generating}
            className="flex-1 rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={generating || !topic.trim()}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate quiz"}
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {attemptId && !outcome && (
        <div className="mt-6 space-y-6">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded border p-4">
              <p className="font-medium">{qi + 1}. {q.question}</p>
              <div className="mt-2 space-y-1">
                {q.options.map((opt, oi) => (
                  <label key={oi} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`q${qi}`}
                      checked={answers[qi] === oi}
                      onChange={() =>
                        setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)))
                      }
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={onSubmit}
            disabled={submitting || answers.some((a) => a === null)}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit answers"}
          </button>
        </div>
      )}

      {outcome && (
        <div className="mt-6 space-y-4">
          <p className="text-lg font-medium">
            Score: {outcome.score} / {outcome.total}
          </p>
          {outcome.results.map((r, i) => (
            <div key={i} className={`rounded border p-4 ${r.correct ? "border-green-400" : "border-red-400"}`}>
              <p className="font-medium">{i + 1}. {r.question}</p>
              <p className="mt-1 text-sm">
                Your answer: {r.options[r.chosen_index]} {r.correct ? "✓" : "✗"}
              </p>
              {!r.correct && (
                <p className="text-sm text-gray-600">Correct answer: {r.options[r.correct_index]}</p>
              )}
            </div>
          ))}
          <button onClick={reset} className="rounded border px-4 py-2 text-sm">
            Take another quiz
          </button>
        </div>
      )}
    </main>
  );
}
