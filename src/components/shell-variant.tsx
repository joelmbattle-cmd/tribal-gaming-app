"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Variant = "desktop" | "mobile";

const ShellVariantContext = createContext<Variant>("desktop");

export function useShellVariant() {
  return useContext(ShellVariantContext);
}

/**
 * Picks a genuinely distinct mobile shell/chrome (bottom tab bar, bottom
 * sheets, FAB controls) vs. the desktop shell (top bar, left rail, slide-in
 * drawer) at runtime — not a CSS-only responsive resize of one component
 * tree. Defaults to desktop during SSR/first paint; resolves to the real
 * viewport immediately after mount.
 */
export function ShellVariantProvider({ children }: { children: React.ReactNode }) {
  const [variant, setVariant] = useState<Variant>("desktop");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 860px)");
    const update = () => setVariant(mq.matches ? "mobile" : "desktop");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return <ShellVariantContext.Provider value={variant}>{children}</ShellVariantContext.Provider>;
}
