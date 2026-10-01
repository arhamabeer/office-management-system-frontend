import type { ReactNode } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { ApprovalsProvider } from '@/context/ApprovalsContext';
import styles from './shell.module.css';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <ApprovalsProvider>
        <div className={styles.shell}>
          <Sidebar />
          <div className={styles.main}>
            <Topbar />
            <main className={styles.content}>{children}</main>
          </div>
        </div>
      </ApprovalsProvider>
    </AuthGuard>
  );
}
