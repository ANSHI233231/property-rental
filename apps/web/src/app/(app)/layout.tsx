import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth/context";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
