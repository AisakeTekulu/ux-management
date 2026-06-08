import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-4">
        <h2 className="text-2xl font-semibold text-text">
          This page doesn&apos;t exist
        </h2>
        <p className="text-sm text-text-subdued">
          The page you requested could not be found.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-colors"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
