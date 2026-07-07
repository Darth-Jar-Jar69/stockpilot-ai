"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Brain,
  GitCompare,
  LayoutDashboard,
  LineChart,
  LogOut,
  Newspaper,
  MessageCircle,
  ScanSearch,
  Shield,
  Wallet,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/scanner", label: "Market Scanner", icon: ScanSearch },
  { href: "/screener", label: "Stock Screener", icon: Activity },
  { href: "/assistant", label: "AI Assistant", icon: MessageCircle },
  { href: "/watchlist", label: "Watchlist", icon: LineChart },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/backtesting", label: "Backtesting", icon: BarChart3 },
  { href: "/paper-trading", label: "Paper Trading", icon: Brain },
  { href: "/settings", label: "Settings", icon: Shield },
] as const;

/** Sidebar navigation with session-based account menu. */
export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string>();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setEmail(data.user?.email))
      .catch(() => setEmail(undefined));
  }, []);

  const handleSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border/50 glass-strong lg:flex">
      <div className="flex h-16 items-center border-b border-border/50 px-6">
        <Logo showTagline />
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 p-4">
        <div className="flex flex-col gap-2 rounded-lg px-2 py-2">
          {email && (
            <p className="truncate text-xs text-slate-300" title={email}>
              {email}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            className="justify-start text-slate-200"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </aside>
  );
}
