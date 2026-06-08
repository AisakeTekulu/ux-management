'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-text">
              Something went wrong
            </h1>
            <p className="text-sm text-text-subdued">
              An unexpected error occurred. Please try again or return to the
              home page.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface transition-colors"
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
