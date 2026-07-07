import { NewsView } from "@/components/features/news/news-view";

export const metadata = {
  title: "Market News | StockPilot",
  description: "Live market headlines with related tickers, company names, and price moves.",
};

export default function NewsPage() {
  return <NewsView />;
}
