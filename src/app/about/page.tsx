export const metadata = {
  title: 'About - Fast Takeoff News',
  description: 'Real-time news from on-the-ground sources. Technology and process behind Fast Takeoff News.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <div className="container mx-auto px-8 py-16 max-w-4xl">

        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-100 mb-6">
            Fast Takeoff News
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Real-time news from on-the-ground sources.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-16">


          {/* Technology Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-100 mb-6">Technology</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-emerald-900/20 to-gray-800/50 rounded-lg p-6 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
                <h3 className="text-lg font-semibold text-emerald-400 mb-4">AI & Machine Learning</h3>
                <ul className="text-gray-300 text-base space-y-2 list-none">
                  <li>Language model: google/gemini-2.5-flash-lite</li>
                  <li>Image generation: google/gemini-2.5-flash-image-preview</li>
                  <li>Provider: OpenRouter</li>
                </ul>
              </div>
              <div className="bg-gradient-to-br from-emerald-900/20 to-gray-800/50 rounded-lg p-6 border border-emerald-500/30 hover:border-emerald-500/50 transition-colors">
                <h3 className="text-lg font-semibold text-emerald-400 mb-4">Infrastructure</h3>
                <ul className="text-gray-300 text-base space-y-2 list-none">
                  <li>Platform: Next.js, Cloudflare Pages</li>
                  <li>Database: Cloudflare D1 (SQLite)</li>
                  <li>Cache: Cloudflare KV Storage</li>
                  <li>CDN: Cloudflare Global Network</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section>
            <h2 className="text-2xl font-bold text-gray-100 mb-6">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-lg p-6 border border-gray-600/30 hover:border-emerald-500/30 transition-colors">
                <h3 className="text-lg font-semibold text-gray-100 mb-3">1. Data Collection</h3>
                <p className="text-gray-300 text-base">
                  OSINT Discord channels, RSS feeds, market data, executive orders
                </p>
              </div>
              <div className="bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-lg p-6 border border-gray-600/30 hover:border-emerald-500/30 transition-colors">
                <h3 className="text-lg font-semibold text-gray-100 mb-3">2. AI Processing</h3>
                <p className="text-gray-300 text-base">
                  Entity extraction, report generation, image creation
                </p>
              </div>
              <div className="bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-lg p-6 border border-gray-600/30 hover:border-emerald-500/30 transition-colors">
                <h3 className="text-lg font-semibold text-gray-100 mb-3">3. Dynamic Systems</h3>
                <p className="text-gray-300 text-base">
                  Activity-driven reports, visualizations, analytics
                </p>
              </div>
              <div className="bg-gradient-to-r from-gray-800/40 to-gray-900/40 rounded-lg p-6 border border-gray-600/30 hover:border-emerald-500/30 transition-colors">
                <h3 className="text-lg font-semibold text-gray-100 mb-3">4. Distribution</h3>
                <p className="text-gray-300 text-base">
                  Global CDN, real-time updates, social integration
                </p>
              </div>
            </div>
          </section>


        </div>
      </div>
    </div>
  );
}