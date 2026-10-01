import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { BRAND } from '@ems/config';
import { AuthProvider } from '@/context/AuthContext';
import './theme.generated.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: `${BRAND.productName} — Employee Management System`,
    template: `%s · ${BRAND.productName}`,
  },
  description: `${BRAND.productName} — enterprise employee self-service portal.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes on <body> before React hydrates, which is harmless. */}
      <body suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
