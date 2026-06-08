export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-surface-subdued" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    </div>
  );
}
