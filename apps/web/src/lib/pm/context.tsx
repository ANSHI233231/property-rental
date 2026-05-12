"use client";

/**
 * PM property context.
 *
 * A PM is scoped to exactly ONE property (PropertyScopeGuard on the API).
 * After login, we call GET /properties (token-scoped — returns only their property)
 * and cache the result here so all PM pages can use the propertyId without re-fetching.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "@/lib/auth/context";
import { RoleEnum } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PmProperty {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  timezone: string;
}

interface PmPropertyContextValue {
  property: PmProperty | null;
  propertyId: string | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch if needed after a mutation. */
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const PmPropertyContext = createContext<PmPropertyContextValue | null>(null);

interface ApiPropertyResponse {
  data?: PmProperty[];
  items?: PmProperty[];
}

export function PmPropertyProvider({ children }: { children: React.ReactNode }) {
  const { user, apiFetch } = useAuth();
  const [property, setProperty] = useState<PmProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    // Only fetch for PM role
    if (!user || user.role !== RoleEnum.PROPERTY_MANAGER) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchProperty() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch<ApiPropertyResponse | PmProperty[]>("/properties?limit=1");
        if (!cancelled) {
          // Normalise response shape
          let items: PmProperty[] = [];
          if (Array.isArray(res)) {
            items = res as PmProperty[];
          } else {
            items = (res as ApiPropertyResponse).data ?? (res as ApiPropertyResponse).items ?? [];
          }
          setProperty(items[0] ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load property";
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchProperty();
    return () => { cancelled = true; };
  }, [user, apiFetch, version]);

  const value: PmPropertyContextValue = {
    property,
    propertyId: property?.id ?? null,
    loading,
    error,
    reload,
  };

  return (
    <PmPropertyContext.Provider value={value}>
      {children}
    </PmPropertyContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePmProperty(): PmPropertyContextValue {
  const ctx = useContext(PmPropertyContext);
  if (!ctx) {
    throw new Error("usePmProperty must be used inside <PmPropertyProvider>");
  }
  return ctx;
}
