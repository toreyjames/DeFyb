"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

export default function BrandHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const showLogout = pathname !== "/login";

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="brand-shell">
      <Image src="/defyb-logo.svg" alt="DeFyb" width={220} height={48} priority />
      <div>
        <p className="eyebrow">Billing Intelligence MVP</p>
        <h2>AI Scribe to Billing Intelligence to Revenue Optimization</h2>
        <p className="subtitle">
          Capture underbilling, close documentation gaps, and route next-best revenue actions.
        </p>
      </div>
      {showLogout ? (
        <button type="button" className="secondary logout-button" onClick={logout}>
          Log Out
        </button>
      ) : null}
    </header>
  );
}
