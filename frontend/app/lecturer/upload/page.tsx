"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";

interface Course {
  course_id: string;
  code: string;
  title: string;
  owner_id: string | null;
}

interface DocumentRow {
  document_id: string;
  title: string;
  source_type: string;
  created_at: string;
  chunk_count: number;
}

const inputClass =
  "rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-accent/40";

export default function LecturerUploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingCourse, setAddingCourse] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "lecturer")) router.push("/courses");
  }, [loading, user, router]);

  function loadCourses() {
    apiFetch<Course[]>("/courses?mine=true").then((cs) => {
      setCourses(cs);
      setCourseId((current) => (cs.some((c) => c.course_id === current) ? current : (cs[0]?.course_id ?? "")));
    });
  }

  useEffect(() => {
    if (user?.role === "lecturer") loadCourses();
  }, [user]);

  useEffect(() => {
    if (!courseId) return;
    setDocumentsLoading(true);
    setDeleteConfirmText("");
    apiFetch<DocumentRow[]>(`/courses/${courseId}/documents`)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocumentsLoading(false));
  }, [courseId]);

  const selectedCourse = courses.find((c) => c.course_id === courseId) ?? null;

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
      toast(`Course ${course.code} created`);
    } catch (err) {
      setCourseError(err instanceof ApiError ? err.message : "Could not create the course");
    } finally {
      setCreatingCourse(false);
    }
  }

  async function onDeleteCourse() {
    if (!selectedCourse || deleteConfirmText !== selectedCourse.code) return;
    setDeleting(true);
    try {
      await apiFetch(`/courses/${selectedCourse.course_id}`, { method: "DELETE" });
      toast(`${selectedCourse.code} deleted`);
      setDeleteConfirmText("");
      loadCourses();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Could not delete the course", "error");
    } finally {
      setDeleting(false);
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
      toast(`${doc.title} uploaded and embedded (${doc.chunk_count} chunks)`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (loading || !user) return null;

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-xl font-semibold tracking-tight">Upload course material</h1>

      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="course">Course</label>
          {!addingCourse ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                id="course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className={`w-full min-w-0 ${inputClass}`}
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
                className="whitespace-nowrap rounded-xl border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/10 hover:text-accent"
              >
                + New course
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-background p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="Code, e.g. CSC311"
                  className={`min-w-0 sm:w-32 ${inputClass}`}
                />
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Title, e.g. Data Structures"
                  className={`min-w-0 flex-1 ${inputClass}`}
                />
              </div>
              {courseError && (
                <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
                  {courseError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCreateCourse}
                  disabled={creatingCourse || !newCode.trim() || !newTitle.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {creatingCourse && <Spinner className="h-3.5 w-3.5" />}
                  {creatingCourse ? "Creating..." : "Create course"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingCourse(false);
                    setCourseError(null);
                  }}
                  className="rounded-xl border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-border/30"
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
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-accent/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent hover:file:bg-accent/20"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <button
          onClick={onUpload}
          disabled={!file || uploading}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {uploading && <Spinner className="h-4 w-4" />}
          {uploading ? "Uploading & embedding..." : "Upload"}
        </button>
      </div>

      <h2 className="mt-8 text-base font-semibold">Uploaded material</h2>
      <ul className="mt-3 space-y-2">
        {documentsLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-14 w-full rounded-2xl" />)
        ) : (
          <>
            {documents.map((d) => (
              <li key={d.document_id} className="rounded-2xl border border-border bg-surface p-3.5 text-sm shadow-sm">
                <strong className="font-semibold">{d.title}</strong>
                <span className="text-muted"> — {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"} — {new Date(d.created_at).toLocaleString()}</span>
              </li>
            ))}
            {documents.length === 0 && (
              <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                No material uploaded yet.
              </li>
            )}
          </>
        )}
      </ul>

      {selectedCourse && (
        <div className="mt-10 rounded-2xl border border-danger-border bg-danger-bg p-5">
          <h2 className="text-sm font-semibold text-danger">Danger zone</h2>
          <p className="mt-1 text-sm text-danger/90">
            Deleting <strong>{selectedCourse.code}</strong> permanently removes its uploaded material, every
            student&apos;s conversations and quiz attempts, and its topic tags. This can&apos;t be undone.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={`Type ${selectedCourse.code} to confirm`}
              className="min-w-0 flex-1 rounded-xl border border-danger-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-danger/40"
            />
            <button
              onClick={onDeleteCourse}
              disabled={deleting || deleteConfirmText !== selectedCourse.code}
              className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {deleting && <Spinner className="h-4 w-4" />}
              {deleting ? "Deleting..." : `Delete ${selectedCourse.code}`}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
