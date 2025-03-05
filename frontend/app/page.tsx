import { ArrowRight, FileText, Search, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="py-12 sm:py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-100 sm:text-5xl md:text-6xl">
            Track Executive Orders
            <span className="block text-blue-400">Stay Informed</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-400 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Monitor, analyze, and stay up-to-date with executive orders from the Federal Register.
            Access the latest policy changes and government directives in one place.
          </p>
          <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
            <div className="rounded-md shadow-lg shadow-blue-500/20">
              <Link
                href="/orders"
                className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors md:py-4 md:text-lg md:px-10"
              >
                Browse Orders
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Section */}
      <div className="py-12 bg-[#1E293B] rounded-lg border border-blue-900/30">
        <div className="max-w-xl mx-auto px-4 sm:px-6 lg:max-w-7xl lg:px-8">
          <h2 className="sr-only">Features</h2>
          <div className="grid grid-cols-1 gap-y-12 lg:grid-cols-3 lg:gap-x-8">
            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white">
                <Search className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-gray-100">
                  Search & Filter
                </h3>
                <p className="mt-2 text-base text-gray-400">
                  Easily search through executive orders by title, agency, or date. Filter results to find exactly what you need.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white">
                <TrendingUp className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-gray-100">
                  Track Changes
                </h3>
                <p className="mt-2 text-base text-gray-400">
                  Monitor new executive orders as they&apos;re published. Stay informed about policy changes and government directives.
                </p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-blue-600 text-white">
                <FileText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="ml-16">
                <h3 className="text-lg font-medium text-gray-100">
                  Detailed Analysis
                </h3>
                <p className="mt-2 text-base text-gray-400">
                  Access detailed information about each order, including summaries, agency details, and related documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Latest Orders Preview */}
      <div className="py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-100">Latest Executive Orders</h2>
          <p className="mt-2 text-gray-400">Stay up to date with the most recent policy changes</p>
        </div>
        <div className="bg-[#1E293B] rounded-lg border border-blue-900/30 p-6">
          <Link
            href="/orders"
            className="block text-center text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            View all orders →
          </Link>
        </div>
      </div>
    </div>
  );
}
