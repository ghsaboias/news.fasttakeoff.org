import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Executive Orders Tracker",
  description: "Track and analyze executive orders from the Federal Register",
  keywords: "executive orders, federal register, government, policy tracking",
  icons: {
    icon: [
      {
        url: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📔</text></svg>',
        type: 'image/svg+xml',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0F172A] text-gray-100`}>
        <nav className="border-b border-blue-900/30 bg-[#1E293B]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link
                  href="/"
                  className="flex items-center px-2 text-blue-400 font-semibold text-lg hover:text-blue-300 transition-colors"
                >
                  Executive Orders Tracker
                </Link>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    href="/executive-orders"
                    className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-300 hover:text-blue-400 transition-colors"
                  >
                    Browse Orders
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="min-h-[calc(100vh-4rem)]">
          {children}
        </main>
        <footer className="border-t border-blue-900/30 bg-[#1E293B]">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-400">
              Data provided by the Federal Register API. Built with Next.js and FastAPI.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
