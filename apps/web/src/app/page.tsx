import { APP_NAME, ROLES, SHARED_PACKAGE_VERSION } from "@gharsetu/shared";

/**
 * Phase 0 stub homepage.
 *
 * Proves three things end-to-end:
 *   1. Next.js 15 App Router is wired up (Server Component rendering).
 *   2. apps/web successfully consumes @gharsetu/shared from its compiled dist/
 *      (this is the P1 contract — see docs/MASTER_PLAN.md §7).
 *   3. The web app can reach the API health endpoint, which in turn reaches
 *      Postgres via Prisma.
 *
 * Phase 1+ replaces this with the real /login route and role-based redirects.
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api/v1";

interface ApiHealth {
  status: string;
  app: string;
  sharedVersion: string;
  db: string;
  redis: string;
  timestamp: string;
}

async function fetchHealth(): Promise<ApiHealth | { error: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      cache: "no-store",
      // Keep the server-render fast even if the API is down.
      signal: AbortSignal.timeout(2_000),
    });
    if (!res.ok) return { error: `API returned ${res.status}` };
    return (await res.json()) as ApiHealth;
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export default async function HomePage() {
  const health = await fetchHealth();

  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>{APP_NAME}</h1>
      <p style={{ color: "#666", marginTop: 0 }}>
        Phase 0 — monorepo scaffold. Real UI lands in Phase 1.
      </p>

      <section
        style={{
          marginTop: 32,
          padding: 16,
          border: "1px solid #E0E0E0",
          borderRadius: 8,
          background: "#FFFFFF",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>@gharsetu/shared wiring</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>
            <strong>App name (from shared):</strong> {APP_NAME}
          </li>
          <li>
            <strong>Shared package version:</strong> {SHARED_PACKAGE_VERSION}
          </li>
          <li>
            <strong>Roles (from shared):</strong> {ROLES.join(", ")}
          </li>
        </ul>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #E0E0E0",
          borderRadius: 8,
          background: "#FFFFFF",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>API health ({API_BASE_URL}/health)</h2>
        <pre
          style={{
            background: "#F1F3F5",
            padding: 12,
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 13,
          }}
        >
          {JSON.stringify(health, null, 2)}
        </pre>
      </section>
    </main>
  );
}
