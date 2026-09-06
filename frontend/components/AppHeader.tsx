"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname?.startsWith(href + "/");
  return (
    <Link
      href={href}
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

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-3">
        <Link href="/courses" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs text-accent-foreground">
            S
          </span>
          Study Assistant
        </Link>

        {user && (
          <nav className="flex items-center gap-1">
            <NavLink href="/courses">Courses</NavLink>
            {user.role === "lecturer" && (
              <>
                <NavLink href="/lecturer/upload">Upload</NavLink>
                <NavLink href="/lecturer/dashboard">Dashboard</NavLink>
              </>
            )}
            {user.role === "student" && <NavLink href="/history">History</NavLink>}
            <button
              onClick={logout}
              className="ml-2 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:text-foreground"
            >
              Log out
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
