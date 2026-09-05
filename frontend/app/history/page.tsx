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
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "student")) router.push("/courses");
  }, [loading, user, router]);

  useEffect(() => {
    if (user?.role === "student") {
      apiFetch<Course[]>("/courses").then(setCourses);
      apiFetch<Conversation[]>("/conversations").then(setConversations);
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
        <h1 className="text-2xl font-semibold">My conversation history</h1>
        {conversations.length > 0 && (
          <button
            onClick={onDeleteAll}
            disabled={deleting}
            className="text-sm text-red-600 underline disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete all history"}
          </button>
        )}
      </div>

      <div className="mt-6 space-y-6">
        {conversations.map((c) => (
          <div key={c.conversation_id} className="rounded border p-4">
            <p className="text-sm font-medium">{courseLabel(c.course_id)}</p>
            <p className="text-xs text-gray-500">Started {new Date(c.started_at).toLocaleString()}</p>
            <div className="mt-3 space-y-2">
              {c.messages.map((m) => (
                <div
                  key={m.message_id}
                  className={`rounded p-2 text-sm ${m.sender === "user" ? "bg-gray-100" : "bg-blue-50"}`}
                >
                  <span className="font-medium">{m.sender === "user" ? "You" : "Assistant"}:</span> {m.content}
                </div>
              ))}
            </div>
          </div>
        ))}
        {conversations.length === 0 && (
          <p className="text-sm text-gray-500">No conversations yet.</p>
        )}
      </div>
    </main>
  );
}
