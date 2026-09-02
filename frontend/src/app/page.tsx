export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-2xl w-full text-center space-y-6 bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Step 0 — Environment & Project Foundation
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bangladesh Citizen Report Platform
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 text-base">
          Next.js + TypeScript + Tailwind CSS Frontend Foundation initialized successfully.
        </p>
        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
          Awaiting next phase configuration.
        </div>
      </div>
    </main>
  );
}
