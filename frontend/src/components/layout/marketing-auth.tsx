"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

type AuthUser = { id: string; email: string; firstName?: string };

/** Marketing header auth controls — email/password session based. */
export function MarketingAuth() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  };

  if (user) {
    return (
      <>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="mr-1 h-4 w-4" />
          Sign out
        </Button>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" asChild>
        <Link href="/sign-in">Sign in</Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/sign-up">Get started</Link>
      </Button>
    </>
  );
}

/** @deprecated Use MarketingAuth */
export function MarketingHeaderAuth() {
  return <MarketingAuth />;
}
