import type { Metadata } from "next";

import {
  DisclaimerSection,
  FeaturesSection,
  HeroSection,
  HowItWorksSection,
} from "@/components/features/marketing/landing-sections";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: `AI Investment Research with Live Market Data | ${SITE_NAME}`,
  description: SITE_DESCRIPTION,
};

/** Public landing page — marketing entry point at /. */
export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <DisclaimerSection />
    </>
  );
}
