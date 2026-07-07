import type { Appearance } from "@clerk/types";

/** Shared Clerk appearance — high-contrast text on dark backgrounds. */
export const clerkAppearance: Appearance = {
  variables: {
    colorBackground: "hsl(222, 47%, 9%)",
    colorForeground: "hsl(210, 40%, 98%)",
    colorText: "hsl(210, 40%, 97%)",
    colorTextSecondary: "hsl(215, 25%, 82%)",
    colorInputText: "hsl(210, 40%, 98%)",
    colorInputBackground: "hsl(217, 33%, 12%)",
    colorPrimary: "hsl(142, 76%, 45%)",
    colorDanger: "hsl(0, 72%, 58%)",
    colorNeutral: "hsl(215, 25%, 82%)",
    borderRadius: "0.625rem",
    fontSize: "0.9375rem",
  },
  elements: {
    card: "glass border-border/60 shadow-2xl",
    headerTitle: "text-white text-xl font-semibold",
    headerSubtitle: "text-slate-300",
    socialButtonsBlockButton: "border-border/60 text-slate-100",
    socialButtonsBlockButtonText: "text-slate-100 font-medium",
    dividerLine: "bg-border/60",
    dividerText: "text-slate-400",
    formFieldLabel: "text-slate-200 font-medium",
    formFieldInput:
      "text-white bg-secondary/80 border-border/60 placeholder:text-slate-500",
    formButtonPrimary:
      "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold",
    footerActionText: "text-slate-400",
    footerActionLink: "text-primary hover:text-primary/80 font-medium",
    identityPreviewText: "text-slate-100",
    identityPreviewEditButton: "text-primary",
    formFieldErrorText: "text-red-400",
    alertText: "text-slate-200",
    userButtonPopoverCard: "glass border-border/60",
    userButtonPopoverActionButton: "text-slate-100 hover:bg-accent",
    userButtonPopoverActionButtonText: "text-slate-100",
    userButtonPopoverFooter: "text-slate-400",
  },
};
