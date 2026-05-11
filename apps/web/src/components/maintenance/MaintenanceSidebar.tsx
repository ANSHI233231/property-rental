"use client";

/**
 * Maintenance Staff sidebar — Desktop/Tablet (240px, Deep Navy).
 * Matches prototype/maintenance/dashboard.html sidebar exactly.
 * Active item: Saffron 4px left border + tinted background, icon turns Saffron.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/maintenance/dashboard",
    label: "My Requests",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
  },
  {
    href: "/maintenance/all-open",
    label: "All Open",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

const PROFILE_NAV: NavItem = {
  href: "/maintenance/profile",
  label: "My Profile",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

export function MaintenanceSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand">
        Ghar<span>Setu</span>
      </Link>

      <nav className="sidebar-nav" aria-label="Maintenance navigation">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${isActive(item.href) ? " active" : ""}`}
            aria-current={isActive(item.href) ? "page" : undefined}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}

        <div className="sidebar-divider" />

        <Link
          href={PROFILE_NAV.href}
          className={`sidebar-link${isActive(PROFILE_NAV.href) ? " active" : ""}`}
          aria-current={isActive(PROFILE_NAV.href) ? "page" : undefined}
        >
          {PROFILE_NAV.icon}
          {PROFILE_NAV.label}
        </Link>
      </nav>

      <div className="sidebar-footer">
        Maintenance &middot; {user?.name ?? "—"}
        <br />
        <button
          type="button"
          onClick={() => void logout()}
          className="text-saffron font-poppins font-medium hover:underline focus-visible:outline-none"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Bottom tab bar — mobile only (max 5 items, no hamburger)
// ---------------------------------------------------------------------------

const TAB_ITEMS: NavItem[] = [
  {
    href: "/maintenance/dashboard",
    label: "My Requests",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
  },
  {
    href: "/maintenance/all-open",
    label: "All Open",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
];

export function MaintenanceTabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="tabbar" aria-label="Maintenance navigation (mobile)">
      {TAB_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`tab${isActive(item.href) ? " active" : ""}`}
          aria-current={isActive(item.href) ? "page" : undefined}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
