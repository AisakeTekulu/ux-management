/**
 * Admin route-group layout (Admin_Dashboard surface).
 *
 * Frames all authenticated admin pages (Dashboard, Clients, Projects, Tasks,
 * Sign-offs, Activity, Settings) with the Polaris-inspired AppShell: a
 * persistent left sidebar, a top header region, and the main content area,
 * with collapse/expand state persisted to localStorage (task 17.1;
 * Requirements 14.1, 16.1, 16.2).
 *
 * Wraps children in ToastProvider so all admin views can call useToast() to
 * display confirmation toasts on create/edit/delete actions (R14.6).
 *
 * Route protection is handled by middleware (task 16.2; R1.3).
 */
import { AppShell } from "@/components/ui/AppShell";
import { ToastProvider } from "@/components/ui/Toast";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <ToastProvider>{children}</ToastProvider>
    </AppShell>
  );
}
