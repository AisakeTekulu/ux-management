'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-text">
            Something went wrong
          </h2>
          <p className="text-sm text-text-subdued">
            {error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
