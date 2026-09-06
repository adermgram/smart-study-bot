"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";

interface Course {
  course_id: string;
  code: string;
  title: string;
}

interface Message {
  message_id: string;
  sender: "user" | "assistant";
  content: string;
  grounded: boolean;
  created_at: string;
}

interface Conversation {
  conversation_id: string;
  course_id: string;
  started_at: string;
  messages: Message[];
}

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "student") {
      setDataLoading(true);
      Promise.all([apiFetch<Course[]>("/courses"), apiFetch<Conversation[]>("/conversations")])
        .then(([cs, convs]) => {
          setCourses(cs);
          setConversations(convs);
        })
        .finally(() => setDataLoading(false));
    }
  }, [user]);

  function courseLabel(courseId: string) {
    const c = courses.find((c) => c.course_id === courseId);
    return c ? `${c.code} — ${c.title}` : courseId;
  }

  async function onDeleteAll() {
    if (!confirm("Delete all of your conversation history? This can't be undone.")) return;
    setDeleting(true);
    try {
      await apiFetch("/conversations", { method: "DELETE" });
      setConversations([]);
    } finally {
      setDeleting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">My conversation history</h1>
        {conversations.length > 0 && (
          <button
            onClick={onDeleteAll}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger-bg disabled:opacity-50"
          >
            {deleting && <Spinner className="h-3.5 w-3.5" />}
            {deleting ? "Deleting..." : "Delete all history"}
          </button>
        )}
      </div>

      {dataLoading ? (
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 rounded-2xl border border-border bg-surface p-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {conversations.map((c) => (
            <div key={c.conversation_id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-sm font-medium">{courseLabel(c.course_id)}</p>
              <p className="text-xs text-muted">Started {new Date(c.started_at).toLocaleString()}</p>
              <div className="mt-3 space-y-2">
                {c.messages.map((m) => (
                  <div
                    key={m.message_id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      m.sender === "user" ? "bg-accent/10" : "border border-border bg-background"
                    }`}
                  >
                    <span className="font-medium">{m.sender === "user" ? "You" : "Assistant"}:</span> {m.content}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No conversations yet.
            </p>
          )}
        </div>
      )}
    </main>
  );
}
