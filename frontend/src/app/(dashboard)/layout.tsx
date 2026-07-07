import { DashboardAssistant } from "@/components/layout/dashboard-assistant";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";

/** Authenticated app shell — sidebar + scrollable main content + AI assistant. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex flex-1 flex-col overflow-auto">{children}</main>
      <DashboardAssistant />
    </div>
  );
}
