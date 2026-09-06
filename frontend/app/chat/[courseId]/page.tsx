"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { TypingDots } from "@/components/ui/Spinner";

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

interface ConversationResponse {
  conversation_id: string;
  course_id: string;
  messages: { sender: "user" | "assistant"; content: string; grounded: boolean }[];
}

export default function ChatPage({ params }: PageProps<"/chat/[courseId]">) {
  const { courseId } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [question, setQuestion] = useState(() => searchParams.get("q") ?? "");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    apiFetch<Course[]>("/courses").then((cs) => {
      setCourse(cs.find((c) => c.course_id === courseId) ?? null);
    });
  }, [courseId]);

  // A page refresh used to wipe the conversation from view even though it was already
  // persisted server-side -- every exchange is saved via /courses/{id}/ask, it just
  // wasn't being loaded back in. Hydrate from the student's existing conversation for
  // this course, if one exists, instead of always starting blank.
  useEffect(() => {
    if (user?.role !== "student") return;
    apiFetch<ConversationResponse[]>("/conversations")
      .then((convs) => {
        const existing = convs.find((c) => c.course_id === courseId);
        if (existing) {
          setMessages(existing.messages.map((m) => ({ sender: m.sender, content: m.content, grounded: m.grounded })));
        }
      })
      .finally(() => setHistoryLoaded(true));
  }, [user, courseId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, asking]);

  useEffect(() => {
    if (question) inputRef.current?.focus();
  }, [question]);

  async function onAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || asking) return;
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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4 sm:p-6">
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-accent/5 to-transparent px-5 py-4">
          {course ? (
            <div>
              <h1 className="text-lg font-semibold tracking-tight">{course.code}</h1>
              <p className="text-sm text-muted">{course.title}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {historyLoaded && messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M8 10.5h8M8 14h5M21 12a9 9 0 1 1-4.5-7.79L21 3l-1.2 4.5A9 9 0 0 1 21 12Z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-4 max-w-xs text-sm text-muted">
                Ask anything about this course&apos;s uploaded material -- I&apos;ll answer strictly from what&apos;s been shared.
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`animate-fade-in flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.sender === "user"
                    ? "rounded-br-md bg-accent text-accent-foreground"
                    : "rounded-bl-md border border-border bg-background text-foreground"
                }`}
              >
                {m.content}
                {m.sender === "assistant" && m.grounded === false && (
                  <div className="mt-2 inline-block rounded-full border border-warning-border bg-warning-bg px-2.5 py-0.5 text-xs font-medium text-warning">
                    Not found in course material
                  </div>
                )}
              </div>
            </div>
          ))}
          {asking && (
            <div className="animate-fade-in flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-border bg-background px-4 py-3 text-muted shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {error && (
          <p className="mx-5 mb-2 rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <form onSubmit={onAsk} className="flex gap-2 border-t border-border p-4">
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            disabled={asking}
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}
