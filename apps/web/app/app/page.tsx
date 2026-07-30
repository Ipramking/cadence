"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, isOnboarded, isSignedIn, type Autonomy } from "@/lib/session";
import { warmup } from "@/lib/api";
import { AgentHome } from "@/components/AgentHome";
import { ManualHome } from "@/components/ManualHome";
import { HybridHome } from "@/components/HybridHome";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [autonomy, setAutonomy] = useState<Autonomy>("automatic");

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    if (!isOnboarded()) {
      router.replace("/onboarding");
      return;
    }
    setAutonomy(getSession()?.autonomy ?? "automatic");
    setReady(true);
    warmup();
    const id = setInterval(warmup, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [router]);

  if (!ready) return null;

  if (autonomy === "manual") return <ManualHome />;
  if (autonomy === "hybrid")
    return (
      <div className="h-[100dvh]">
        <HybridHome />
      </div>
    );
  return (
    <div className="h-[100dvh]">
      <AgentHome autonomy="automatic" />
    </div>
  );
}
