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

interface DocumentRow {
  document_id: string;
  title: string;
  source_type: string;
  created_at: string;
  chunk_count: number;
}

export default function LecturerUploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingCourse, setAddingCourse] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

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
    apiFetch<DocumentRow[]>(`/courses/${courseId}/documents`).then(setDocuments).catch(() => setDocuments([]));
  }, [courseId]);

  async function onCreateCourse() {
    if (!newCode.trim() || !newTitle.trim()) return;
    setCourseError(null);
    setCreatingCourse(true);
    try {
      const course = await apiFetch<Course>("/courses", {
        method: "POST",
        body: JSON.stringify({ code: newCode.trim(), title: newTitle.trim() }),
      });
      setCourses((cs) => [...cs, course].sort((a, b) => a.code.localeCompare(b.code)));
      setCourseId(course.course_id);
      setNewCode("");
      setNewTitle("");
      setAddingCourse(false);
    } catch (err) {
      setCourseError(err instanceof ApiError ? err.message : "Could not create the course");
    } finally {
      setCreatingCourse(false);
    }
  }

  async function onUpload() {
    if (!file || !courseId) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/courses/${courseId}/documents`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ detail: res.statusText }));
        throw new ApiError(res.status, body.detail ?? "Upload failed");
      }
      const doc: DocumentRow = await res.json();
      setDocuments((docs) => [doc, ...docs]);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Upload course material</h1>

      <div className="mt-6 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="course">Course</label>
          {!addingCourse ? (
            <div className="flex gap-2">
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
              <button
                type="button"
                onClick={() => setAddingCourse(true)}
                className="whitespace-nowrap rounded border px-3 py-2 text-sm"
              >
                + New course
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded border p-3">
              <div className="flex gap-2">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Code, e.g. CSC311"
                  className="w-32 rounded border px-3 py-2 text-sm"
                />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title, e.g. Data Structures"
                  className="flex-1 rounded border px-3 py-2 text-sm"
                />
              </div>
              {courseError && <p className="text-sm text-red-600">{courseError}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCreateCourse}
                  disabled={creatingCourse || !newCode.trim() || !newTitle.trim()}
                  className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {creatingCourse ? "Creating..." : "Create course"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCourse(false);
                    setCourseError(null);
                  }}
                  className="rounded border px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="file">File (PDF, DOCX, TXT, or MD)</label>
          <input
            id="file"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={onUpload}
          disabled={!file || uploading}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {uploading ? "Uploading & embedding..." : "Upload"}
        </button>
      </div>

      <h2 className="mt-8 text-lg font-medium">Uploaded material</h2>
      <ul className="mt-2 space-y-2">
        {documents.map((d) => (
          <li key={d.document_id} className="rounded border p-3 text-sm">
            <strong>{d.title}</strong> — {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"} —{" "}
            {new Date(d.created_at).toLocaleString()}
          </li>
        ))}
        {documents.length === 0 && <li className="text-sm text-gray-500">No material uploaded yet.</li>}
      </ul>
    </main>
  );
}
