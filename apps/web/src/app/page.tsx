/**
 * Landing page — 1:1 with prototype/index.html.
 *
 * Public marketing surface with role-picker. Real auth lives at /login.
 * Hero + role cards + module strip + footer.
 */

import Link from "next/link";

export const metadata = {
  title: "GharSetu — Property Rental Management",
  description:
    "Delhi-first property management. Replace paper folders, spreadsheets and WhatsApp groups. Manage 120 units across 18 buildings from a single role-scoped dashboard.",
};

export default function HomePage() {
  return (
    <main className="bg-off-white">
      {/* Hero header */}
      <header className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-poppins font-bold text-xl tracking-wide">
            Ghar<span className="text-saffron">Setu</span>
          </div>
          <Link
            href="/login"
            className="btn btn-primary !py-2 !px-5 !text-sm"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero section */}
      <section className="bg-navy text-white">
        <div className="max-w-6xl mx-auto px-6 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-poppins text-saffron font-semibold uppercase tracking-widest text-sm mb-3">
              Delhi-First Property Management
            </p>
            <h1
              className="text-white"
              style={{ color: "#fff", fontSize: "44px", lineHeight: 1.1 }}
            >
              Stop Losing Track. Start Running Smoothly.
            </h1>
            <p className="text-white/80 mt-5 text-lg">
              Replace paper folders, spreadsheets and WhatsApp groups. Manage{" "}
              <strong>120 units across 18 buildings</strong> from a single
              role-scoped dashboard.
            </p>
            <div className="flex gap-3 mt-8 flex-wrap">
              <Link href="/login" className="btn btn-primary">
                Login to GharSetu
              </Link>
              <a
                href="#roles"
                className="btn btn-secondary !text-white !border-white"
              >
                Explore by role
              </a>
            </div>
          </div>

          <div className="hidden md:block">
            <div className="card bg-white/10 border-white/10 backdrop-blur p-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="kpi !bg-white/5 !border-white/10">
                  <div className="kpi-label !text-white/70">Buildings</div>
                  <div className="kpi-value !text-white">18</div>
                </div>
                <div className="kpi !bg-white/5 !border-white/10">
                  <div className="kpi-label !text-white/70">Units</div>
                  <div className="kpi-value !text-white">120</div>
                </div>
                <div className="kpi !bg-white/5 !border-white/10">
                  <div className="kpi-label !text-white/70">Occupancy</div>
                  <div className="kpi-value !text-white">94%</div>
                </div>
                <div className="kpi !bg-white/5 !border-white/10">
                  <div className="kpi-label !text-white/70">Roles</div>
                  <div className="kpi-value !text-white">4</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2>Four roles. Four scoped dashboards.</h2>
          <p className="muted mt-2">
            Each user sees only what they need — no clutter, no confusion.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link href="/admin/dashboard" className="card role-card">
            <div className="role-icon" style={{ background: "#1A237E" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z" />
              </svg>
            </div>
            <h3 className="mt-4">Admin</h3>
            <p className="text-sm muted mt-1">
              Full system control across all 18 properties, users and alerts.
            </p>
            <div className="mt-4 text-saffron font-poppins font-semibold text-sm">
              Open dashboard →
            </div>
          </Link>

          <Link href="/pm/dashboard" className="card role-card">
            <div className="role-icon" style={{ background: "#1565C0" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 21V8l9-5 9 5v13" />
                <path d="M9 21V12h6v9" />
              </svg>
            </div>
            <h3 className="mt-4">Property Manager</h3>
            <p className="text-sm muted mt-1">
              Run one assigned property — leases, rent, tenants and maintenance.
            </p>
            <div className="mt-4 text-saffron font-poppins font-semibold text-sm">
              Open dashboard →
            </div>
          </Link>

          <Link href="/maintenance/dashboard" className="card role-card">
            <div className="role-icon" style={{ background: "#546E7A" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
              </svg>
            </div>
            <h3 className="mt-4">Maintenance Staff</h3>
            <p className="text-sm muted mt-1">
              Just the requests assigned to you. No rent or lease data.
            </p>
            <div className="mt-4 text-saffron font-poppins font-semibold text-sm">
              Open dashboard →
            </div>
          </Link>

          <Link href="/tenant/dashboard" className="card role-card">
            <div className="role-icon" style={{ background: "#FF6F00" }}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20 12V8a2 2 0 0 0-2-2h-1.6L12 2 7.6 6H6a2 2 0 0 0-2 2v4" />
                <path d="M2 13h20l-2 9H4z" />
              </svg>
            </div>
            <h3 className="mt-4">Tenant</h3>
            <p className="text-sm muted mt-1">
              View your lease, rent status and raise maintenance requests.
            </p>
            <div className="mt-4 text-saffron font-poppins font-semibold text-sm">
              Open dashboard →
            </div>
          </Link>
        </div>
      </section>

      {/* Modules strip */}
      <section className="bg-light-gray py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2>Five modules. One platform.</h2>
            <p className="muted mt-2">
              People · Places · Contracts · Complaints · Money
            </p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="card text-center">
              <div className="font-poppins font-semibold text-charcoal">
                Users &amp; Access
              </div>
              <p className="text-sm muted mt-2">
                Role-scoped logins. No public sign-up.
              </p>
            </div>
            <div className="card text-center">
              <div className="font-poppins font-semibold text-charcoal">
                Properties &amp; Units
              </div>
              <p className="text-sm muted mt-2">
                18 buildings, 120 units, 5 unit states.
              </p>
            </div>
            <div className="card text-center">
              <div className="font-poppins font-semibold text-charcoal">
                Leases &amp; Tenants
              </div>
              <p className="text-sm muted mt-2">
                Co-tenant safe. Rent locked at signing.
              </p>
            </div>
            <div className="card text-center">
              <div className="font-poppins font-semibold text-charcoal">
                Maintenance
              </div>
              <p className="text-sm muted mt-2">
                Replaces WhatsApp. Nothing gets lost.
              </p>
            </div>
            <div className="card text-center">
              <div className="font-poppins font-semibold text-charcoal">
                Rent Collection
              </div>
              <p className="text-sm muted mt-2">
                Auto overdue, late fees, prepaid handling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy text-white/70 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>© 2026 GharSetu · Trustworthy · Simple · Delhi-First</div>
          <div className="font-poppins">v1</div>
        </div>
      </footer>
    </main>
  );
}
