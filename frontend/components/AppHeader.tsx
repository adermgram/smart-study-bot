"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/ThemeToggle";

function NavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppHeader() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = user ? (
    <>
      <NavLink href="/courses" onClick={() => setMenuOpen(false)}>Courses</NavLink>
      {user.role === "lecturer" && (
        <>
          <NavLink href="/lecturer/upload" onClick={() => setMenuOpen(false)}>Upload</NavLink>
          <NavLink href="/lecturer/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
        </>
      )}
      {user.role === "student" && <NavLink href="/history" onClick={() => setMenuOpen(false)}>History</NavLink>}
      <button
        onClick={() => {
          setMenuOpen(false);
          logout();
        }}
        className="rounded-md px-3 py-1.5 text-left text-sm text-muted transition-colors hover:text-foreground"
      >
        Log out
      </button>
    </>
  ) : null;

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link href="/courses" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs text-accent-foreground">
            S
          </span>
          Study Assistant
        </Link>

        <div className="flex items-center gap-1">
          {user && <nav className="hidden items-center gap-1 sm:flex">{navItems}</nav>}
          <ThemeToggle />
          {user && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-border/40 hover:text-foreground sm:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                ) : (
                  <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-border px-6 py-3 sm:hidden">{navItems}</nav>
      )}
    </header>
  );
}
