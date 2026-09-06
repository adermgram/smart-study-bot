import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/lib/toast";
import { AppHeader } from "@/components/AppHeader";
import { AuthGate } from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Study Assistant Bot",
  description: "Course-grounded conversational study assistant",
};

// Applies a stored theme override before first paint so switching themes doesn't
// flash the wrong colors on the next load -- must run before hydration, hence
// beforeInteractive rather than a useEffect in a regular component.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
        <AuthProvider>
          <ToastProvider>
            <AppHeader />
            <AuthGate>{children}</AuthGate>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
