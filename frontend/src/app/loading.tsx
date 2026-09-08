export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 space-y-4">
      <div className="relative flex items-center justify-center">
        <div className="h-12 w-12 rounded-full border-4 border-emerald-200 dark:border-emerald-950 border-t-emerald-700 animate-spin" />
      </div>
      <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-wide uppercase">
        Loading Nirapotta...
      </p>
    </div>
  );
}
