import { Suspense } from "react";

import { CustomSignInForm } from "@/components/features/auth/custom-sign-in-form";

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-400">Loading…</div>}>
      <CustomSignInForm />
    </Suspense>
  );
}
