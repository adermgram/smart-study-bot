export default async function ChatPage({ params }: PageProps<"/chat/[courseId]">) {
  const { courseId } = await params;
  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Chat — course {courseId}</h1>
      <p className="mt-2 text-sm text-gray-500">
        RAG chat UI lands in build-order phase 5 (see PROJECT_PLAN.md section 14).
      </p>
    </main>
  );
}
