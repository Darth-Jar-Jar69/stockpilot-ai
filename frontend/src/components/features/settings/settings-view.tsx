"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Profile = {
  riskTolerance: string;
  preferredMarkets: string;
  paperCashBalance: number;
  paperStartingCash: number;
};

type Provider = { name: string; status: string; message?: string };

export function SettingsView() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [risk, setRisk] = useState("moderate");
  const [markets, setMarkets] = useState("US");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [backendStatus, setBackendStatus] = useState("checking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/health").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([settings, health]) => {
        if (settings?.profile) {
          setProfile(settings.profile);
          setRisk(settings.profile.riskTolerance);
          setMarkets(settings.profile.preferredMarkets);
        }
        if (health) {
          setBackendStatus(health.status ?? "unknown");
          setProviders(health.providers ?? []);
        } else {
          setBackendStatus("offline");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskTolerance: risk, preferredMarkets: markets }),
    });
    if (res.ok) {
      const data = await res.json();
      setProfile(data.profile);
      setSaved(true);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Risk profile, markets, and data provider status.</p>
      </div>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Risk Profile</CardTitle>
          <CardDescription className="text-slate-400">
            Used by portfolio suggestions and paper-trading defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Risk tolerance</Label>
            <div className="flex flex-wrap gap-2">
              {["conservative", "moderate", "aggressive"].map((level) => (
                <Button
                  key={level}
                  type="button"
                  variant={risk === level ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRisk(level)}
                  className="capitalize"
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="markets" className="text-slate-300">
              Preferred markets
            </Label>
            <input
              id="markets"
              value={markets}
              onChange={(e) => setMarkets(e.target.value)}
              className="w-full rounded-md border border-border/60 bg-secondary/50 px-3 py-2 text-sm text-white"
              placeholder="US, EU, Asia"
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save preferences
          </Button>
          {saved && <p className="text-sm text-gain">Preferences saved.</p>}
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">Paper Trading Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-300">
          <p>Starting capital: {profile?.paperStartingCash ? `$${profile.paperStartingCash.toLocaleString()}` : "—"}</p>
          <p>Current cash: {profile?.paperCashBalance ? `$${profile.paperCashBalance.toLocaleString()}` : "—"}</p>
          <p className="text-xs text-slate-500">Reset from the Paper Trading page.</p>
        </CardContent>
      </Card>

      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="text-white">API &amp; Data Providers</CardTitle>
          <CardDescription className="text-slate-400">
            Backend:{" "}
            <Badge variant={backendStatus === "ok" ? "default" : "secondary"}>{backendStatus}</Badge>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {providers.length === 0 ? (
            <p className="text-sm text-slate-400">
              Start the backend:{" "}
              <code className="text-slate-300">cd backend &amp;&amp; uvicorn app.main:app --reload</code>
            </p>
          ) : (
            providers.map((p) => (
              <Badge key={p.name} variant={p.status === "ok" ? "default" : "secondary"}>
                {p.name}: {p.status}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
