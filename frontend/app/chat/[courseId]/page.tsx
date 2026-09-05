"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

interface ChatMessage {
  sender: "user" | "assistant";
  content: string;
  grounded?: boolean;
}

export default function ChatPage({ params }: PageProps<"/chat/[courseId]">) {
  const { courseId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    apiFetch<Course[]>("/courses").then((cs) => {
      setCourse(cs.find((c) => c.course_id === courseId) ?? null);
    });
  }, [courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setError(null);
    const asked = question;
    setMessages((m) => [...m, { sender: "user", content: asked }]);
    setQuestion("");
    setAsking(true);
    try {
      const res = await apiFetch<{ answer: string; grounded: boolean }>(`/courses/${courseId}/ask`, {
        method: "POST",
        body: JSON.stringify({ question: asked }),
      });
      setMessages((m) => [...m, { sender: "assistant", content: res.answer, grounded: res.grounded }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col p-6">
      <h1 className="text-2xl font-semibold">
        {course ? `${course.code} — ${course.title}` : "Chat"}
      </h1>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500">
            Ask a question about this course&apos;s uploaded material.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg p-3 text-sm ${
              m.sender === "user" ? "ml-auto bg-black text-white" : "bg-gray-100 text-black"
            }`}
          >
            {m.content}
            {m.sender === "assistant" && m.grounded === false && (
              <p className="mt-1 text-xs opacity-60">Not found in course material</p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={onAsk} className="mt-4 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question..."
          disabled={asking}
          className="flex-1 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={asking || !question.trim()}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {asking ? "Thinking..." : "Ask"}
        </button>
      </form>
    </main>
  );
}
