import { NewsView } from "@/components/features/news/news-view";

export const metadata = {
  title: "News Desk | StockPilot",
  description:
    "Live market news desk — headlines wired to tickers, sentiment, and session price moves.",
};

export default function NewsPage() {
  return <NewsView />;
}
