/**
 * Loading skeleton for Tasks page.
 */
export default function TasksLoading() {
  return (
    <div className="space-y-token-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-20 rounded bg-surface-subdued" />
        <div className="h-9 w-28 rounded-lg bg-surface-subdued" />
      </div>
      <div className="h-64 rounded-lg border border-border bg-surface" />
    </div>
  );
}
