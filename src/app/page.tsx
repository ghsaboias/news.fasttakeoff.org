import { NewsFeed } from "@/components/NewsFeed";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">AI World News</h1>
            <p className="text-muted-foreground mt-2">
              Real-time financial and market news from around the world
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8">
            <NewsFeed />
          </div>

          <div className="lg:col-span-4">
            <div className="bg-card p-6 rounded-lg shadow-sm border">
              <h2 className="text-xl font-bold mb-4 text-card-foreground">About This Feed</h2>
              <p className="text-card-foreground mb-4">
                This news feed displays real-time financial and market news from the MKT News API.
                The data is streamed via WebSocket connection, ensuring you get the latest updates as they happen.
              </p>
              <p className="text-card-foreground mb-4">
                The feed includes important market announcements, financial news, and economic indicators
                that may impact global markets.
              </p>
              <div className="text-muted-foreground text-sm pt-4 border-t">
                <p>Data source: wss://api.mktnews.net</p>
                <p>© {new Date().getFullYear()} AI World</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
