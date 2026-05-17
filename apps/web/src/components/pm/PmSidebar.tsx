"use client";

/**
 * PM sidebar — Desktop/Tablet (240px, Deep Navy).
 * Matches prototype/pm/dashboard.html sidebar exactly.
 * Active item: Saffron 4px left border + tinted background, icon turns Saffron.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/pm/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12 12 3l9 9" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/pm/units",
    label: "Units",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="10" rx="1" />
        <path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
        <path d="M9 21v-4M15 21v-4" />
      </svg>
    ),
  },
  {
    href: "/pm/tenants",
    label: "Tenants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/pm/leases",
    label: "Leases",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    href: "/pm/rent-collection",
    label: "Rent Collection",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1v22M5 8h11a3 3 0 0 1 0 6H8" />
      </svg>
    ),
  },
  {
    href: "/pm/maintenance",
    label: "Maintenance",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
  },
];

const PROFILE_NAV: NavItem = {
  href: "/pm/profile",
  label: "My Profile",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="7" r="4" />
      <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
    </svg>
  ),
};

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function PmSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { property } = usePmProperty();

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="sidebar">
      {/* Brand — always navigates to / */}
      <Link href="/" className="sidebar-brand">
        Ghar<span>Setu</span>
      </Link>

      <nav className="sidebar-nav" aria-label="PM navigation">
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
        PM &middot; {user?.name ?? "—"}
        <br />
        {property?.name ?? ""}
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

// PM has 6 desktop nav items — one too many for the 5-slot mobile tab bar.
// Maintenance is accessible via the desktop sidebar only on mobile.
// Icons are kept identical to NAV_ITEMS so the same tile looks the same on
// both desktop and mobile.
const TAB_ITEMS: NavItem[] = [
  {
    href: "/pm/dashboard",
    label: "Home",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12 12 3l9 9" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    href: "/pm/units",
    label: "Units",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="10" rx="1" />
        <path d="M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4" />
        <path d="M9 21v-4M15 21v-4" />
      </svg>
    ),
  },
  {
    href: "/pm/tenants",
    label: "Tenants",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/pm/leases",
    label: "Leases",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    href: "/pm/rent-collection",
    label: "Rent",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 1v22M5 8h11a3 3 0 0 1 0 6H8" />
      </svg>
    ),
  },
];

export function PmTabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="tabbar" aria-label="PM navigation (mobile)">
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
