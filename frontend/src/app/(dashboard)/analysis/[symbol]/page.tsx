import { CompanyResearchView } from "@/components/features/research/company-research-view";

type PageProps = { params: Promise<{ symbol: string }> };

export default async function AnalysisPage({ params }: PageProps) {
  const { symbol } = await params;
  return <CompanyResearchView symbol={symbol} />;
}
