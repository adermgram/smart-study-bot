export default async function QuizPage({ params }: PageProps<"/quiz/[courseId]">) {
  const { courseId } = await params;
  return (
    <main className="mx-auto max-w-2xl flex-1 p-6">
      <h1 className="text-2xl font-semibold">Self-assessment quiz — course {courseId}</h1>
      <p className="mt-2 text-sm text-gray-500">
        Quiz generation UI lands in build-order phase 6 (see PROJECT_PLAN.md section 14).
      </p>
    </main>
  );
}
