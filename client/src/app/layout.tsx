import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '../components/Navbar';
import { DemoModeProvider } from '../context/DemoModeContext';

export const metadata: Metadata = {
  title: 'VibeShield — Automated Security Scanner for Vibe-Coded Apps',
  description: 'Instant SAST & DAST security audits with 0-100 scores and copy-paste AI fix prompts for Cursor and Claude.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-slate-100 antialiased selection:bg-primary-500 selection:text-white">
        <DemoModeProvider>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </DemoModeProvider>
      </body>
    </html>
  );
}
