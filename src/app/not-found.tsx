import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold text-text">404</h1>
        <p className="text-lg text-text-subdued">Page not found</p>
        <p className="text-sm text-text-subdued">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
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
