'use client';

export default function PortalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-4">
        <h2 className="text-xl font-semibold text-text">
          Something went wrong
        </h2>
        <p className="text-sm text-text-subdued">
          We couldn&apos;t load this page. Please check your review link and try
          again.
        </p>
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
