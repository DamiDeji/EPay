import { Sidebar } from '@/components/sidebar';
import { DashboardHeader } from '@/components/header';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="md:pl-64">
        <DashboardHeader />
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
