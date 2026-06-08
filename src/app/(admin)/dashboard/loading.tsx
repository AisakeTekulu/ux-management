/**
 * Instant loading skeleton for the Dashboard while server data loads.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-token-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-7 w-48 rounded bg-surface-subdued" />
        <div className="mt-token-2 h-4 w-72 rounded bg-surface-subdued" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-token-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-border bg-surface" />
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-1 gap-token-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="h-64 rounded-lg border border-border bg-surface" />
        </div>
        <div className="space-y-token-4">
          <div className="h-48 rounded-lg border border-border bg-surface" />
          <div className="h-48 rounded-lg border border-border bg-surface" />
        </div>
      </div>
    </div>
  );
}
