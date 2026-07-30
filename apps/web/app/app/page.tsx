"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, isSignedIn, type Autonomy } from "@/lib/session";
import { AgentHome } from "@/components/AgentHome";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [autonomy, setAutonomy] = useState<Autonomy>("automatic");

  useEffect(() => {
    if (!isSignedIn()) {
      router.replace("/auth");
      return;
    }
    setAutonomy(getSession()?.autonomy ?? "automatic");
    setReady(true);
  }, [router]);

  if (!ready) return null;

  // Automatic is the hero; Hybrid shares the agent home for now.
  // Manual (bank-style) home lands in the next pass.
  return <AgentHome autonomy={autonomy} />;
}
