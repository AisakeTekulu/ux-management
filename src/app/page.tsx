import Link from "next/link";

/**
 * Application landing page. Routes the Designer toward the Admin_Dashboard.
 * The authenticated admin surfaces live under the (admin) route group and the
 * unauthenticated review surface lives under the (portal) route group.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-token-6 px-token-4 text-center">
      <h1 className="text-3xl font-semibold text-text">
        Client Sign-Off Dashboard
      </h1>
      <p className="text-text-subdued">
        Manage client project sign-offs from kickoff to launch.
      </p>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-token-5 py-token-3 font-medium text-text-on-primary transition-colors hover:bg-primary-hovered"
      >
        Go to dashboard
      </Link>
    </main>
  );
}
