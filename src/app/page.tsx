'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { getStartDate } from "@/lib/utils"
import { animate, createScope, Scope } from "animejs"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
export const dynamic = 'force-dynamic';

export default function Home() {
  const [latestExecutiveOrders, setLatestExecutiveOrders] = useState<ExecutiveOrder[]>([])
  const [loadingEO, setLoadingEO] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [isUSBased, setIsUSBased] = useState<boolean | null>(null); // null: unknown, true: US, false: non-US/error

  const root = useRef(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    const checkSize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };

    checkSize();
    window.addEventListener('resize', checkSize);

    return () => window.removeEventListener('resize', checkSize);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const setupAnimation = () => {
      if (scope.current) {
        scope.current.revert();
      }

      scope.current = createScope({ root }).add(() => {
        if (!isSmallScreen) {
          animate('span', {
            y: [
              { to: '-3.75rem', ease: 'outExpo', duration: 600 },
              { to: 0, ease: 'outBounce', duration: 800, delay: 100 }
            ],
            rotate: {
              from: '-1turn',
              delay: 2000
            },
            delay: (_, i) => 2000 + (i * 50),
            ease: 'inOutCirc',
            loopDelay: 1000,
            loop: 0
          });
        } else {
          // Small screen animation for each word in sequence
          const animateWord = (selector: string, startDelay: number) => {
            animate(`${selector} span`, {
              x: [
                { to: '200px', ease: 'outExpo', duration: 600 },
                { to: '-200px', ease: 'linear', duration: 0 },
                { to: '0', ease: 'outBounce', duration: 800 }
              ],
              delay: (_, i) => startDelay + (i * 50),
              ease: 'inOutCirc',
              loopDelay: 1000,
              loop: 0
            });
          };

          // Animate each word with a delay between them
          animateWord('.word-fast', 2000); // First word starts at 2s
          animateWord('.word-takeoff', 3000); // Second word starts at 3s
          animateWord('.word-news', 4000); // Third word starts at 4s
        }
      });
    };

    setupAnimation();

    return () => {
      if (scope.current) {
        scope.current.revert();
      }
    };
  }, [isSmallScreen]);

  useEffect(() => {
    async function checkGeo() {
      try {
        const response = await fetch('/api/geo');
        if (!response.ok) {
          throw new Error(`Geo API error: ${response.status}`);
        }
        const data = await response.json();
        // Treat 'XX' (unknown/local) as potentially US for local dev convenience,
        // or you could treat it as non-US by changing the condition.
        setIsUSBased(data.country === 'US');
      } catch (error) {
        console.error('Error checking geolocation:', error);
        setIsUSBased(false); // Assume non-US on error
      }
    }
    checkGeo();
  }, []);

  async function loadExecutiveOrders() {
    if (!isUSBased) {
      console.log('Skipping Executive Order fetch: Non-US location detected.');
      setLoadingEO(false);
      setLatestExecutiveOrders([]);
      return;
    }
    console.log('US location detected, fetching Executive Orders...');
    try {
      setLoadingEO(true)
      const startDate = getStartDate(1)
      const { orders } = await fetchExecutiveOrders(1, startDate)
      const sortedOrders = [...orders].sort((a, b) => {
        const dateA = a.publication.publicationDate || a.date
        const dateB = b.publication.publicationDate || b.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setLatestExecutiveOrders(sortedOrders.slice(0, 3))
    } catch (error) {
      console.error('Error loading executive orders:', error)
      setLatestExecutiveOrders([]);
    } finally {
      setLoadingEO(false)
    }
  }

  async function loadReports() {
    try {
      setLoadingReports(true)
      const response = await fetch('/api/reports', {
        method: 'GET',
      })
      if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`)
      const fetchedReports = await response.json() as Report[]
      const sortedReports = [...fetchedReports].sort((a, b) => {
        const dateA = a.generatedAt
        const dateB = b.generatedAt
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setReports(sortedReports)
    } catch (error) {
      console.error('[Carousel] Error fetching reports:', error)
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    loadReports();
    if (isUSBased === true) {
      loadExecutiveOrders();
    }
  }, [isUSBased]);

  return (
    <div className="flex flex-col pb-16 w-[100vw] justify-center">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-[540px]:h-[56vh] gap-4 text-center max-[540px]:w-[90%] max-[540px]:mx-auto max-[540px]:mb-10 max-[540px]:mt-4">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4" ref={root}>
            <h1 className="text-6xl md:text-7xl font-bold text-[#167F6E] leading-none flex flex-col sm:block">
              <div className="mb-2 sm:mb-0 sm:inline word-fast">
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>F</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>a</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>s</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>t</span>
              </div>
              <div className="mb-2 sm:mb-0 sm:inline word-takeoff">
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>&nbsp;</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>T</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>a</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>k</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>e</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>o</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>f</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>f</span>
              </div>
              <div className="sm:inline word-news">
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>&nbsp;</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>N</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>e</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>w</span>
                <span style={{ display: 'inline-block', transformOrigin: 'center' }}>s</span>
              </div>
            </h1>
            <p className="text-3xl">AI-powered news for everyone.</p>
          </div>
          <div className="w-48 h-48">
            <Image src="/images/brain_transparent.png" alt="Fast Takeoff News" className="w-full h-full object-contain" width={192} height={192} />
          </div>
        </div>
      </section>

      <section className="mx-auto sm:px-4 w-[90%]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {loadingReports ? (
            Array(4)
              .fill(0)
              .map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full mb-2"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                  </CardFooter>
                </Card>
              ))
          ) : reports.length > 0 ? (
            reports.map(report => (
              <ReportCard key={report.reportId} report={report} showReadMore={false} clickableChannel={true} clickableReport={true} />
            )).slice(0, 4)
          ) : (
            <div className="col-span-2 text-center py-8">
              <p className="text-muted-foreground">No reports found.</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Executive Orders Section - RENDER CONDITIONALLY */}
      {isUSBased === true && (
        <section className="mx-auto sm:px-4 w-[90%] mt-16">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest Executive Orders</h2>
              <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {loadingEO ? (
                Array(3)
                  .fill(0)
                  .map((_, index) => (
                    <Card key={index} className="animate-pulse">
                      <CardHeader>
                        <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-4 bg-muted rounded w-full mb-2"></div>
                        <div className="h-4 bg-muted rounded w-full mb-2"></div>
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                      </CardContent>
                      <CardFooter>
                        <div className="h-8 bg-muted rounded w-1/3"></div>
                      </CardFooter>
                    </Card>
                  ))
              ) : latestExecutiveOrders.length > 0 ? (
                latestExecutiveOrders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))
              ) : (
                <div className="col-span-3 text-center py-8">
                  <p className="text-muted-foreground">No executive orders found.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}