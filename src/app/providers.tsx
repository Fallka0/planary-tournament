"use client";

import { ThemeProvider } from "next-themes";
import { useEffect } from "react";
import { AuthProvider } from "@/components/AuthProvider";

/** Theme (system by default), the Planary sign-in, and the service worker that keeps the beamer working offline. */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>{children}</AuthProvider>
    </ThemeProvider>
  );
}
