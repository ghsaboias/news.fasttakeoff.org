'use client';

import { ReportPanel } from '@/components/ReportPanel';
import { Timeline } from '@/components/Timeline';
import { Skeleton } from '@/components/ui/skeleton';
import { Html, Line, OrbitControls, Sphere } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Vector3, Mesh } from 'three';

// --- Theme Configuration (Simplified from example) ---
const cyberTheme = {
    colors: {
        earthBase: new Color(0x001020),
        earthEmissive: new Color(0x003355), // Slightly lighter blue emissive
        earthSpecular: new Color(0x88aaff), // Bluish specular
        ambientLight: new Color(0x404040),
        directionalLight: new Color(0x00aaff),
        pointLight: new Color(0x00ffff),    // Cyan point light
        cyberCyan: new Color(0x00ffff),        // Bright cyan for borders
        cyberCyanBright: new Color(0x88ffff), // Lighter cyan for coastlines
    },
    opacity: {
        earthOpacity: 0.9,
        countryBordersOpacity: 0.6,
        coastlinesOpacity: 0.4,
    },
};

interface ReportFromAPI {
    reportId: string;
    headline: string;
    city: string;
    body: string;
    generatedAt: string;
    channelId?: string;
    channelName?: string;
    cacheStatus?: 'hit' | 'miss';
    messageCount?: number;
    lastMessageTimestamp?: string;
    userGenerated?: boolean;
    messageIds?: string[];
    timeframe?: string;
    // Optional geo enrichment from API
    lat?: number;
    lon?: number;
    country?: string;
    country_code?: string;
    display_name?: string;
}

interface GeoJsonFeatureCollection {
    type: string;
    features: GeoJsonFeature[];
}

interface GeoJsonFeature {
    type: string;
    properties: {
        name: string;
    };
    geometry: GeoJsonGeometry;
}

interface GeoJsonGeometry {
    type: 'Polygon' | 'MultiPolygon' | 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][] | number[][][][]; // [lon, lat] pairs for LineString, array of [lon, lat] arrays for Polygon, etc.
}

interface NewsMarkerData extends ReportFromAPI {
    lat: number;
    lon: number;
    country?: string;
    country_code?: string;
    display_name?: string;
    generatedAtMs?: number;
}

interface MarkerProps {
    position: [number, number, number];
    data: NewsMarkerData;
    onSelect: (data: NewsMarkerData) => void;
    visible: boolean;
}

const Marker = React.memo<MarkerProps>(function Marker({ position, data, onSelect, visible }) {
    const [hovered, setHovered] = React.useState(false);

    const handleSphereClick = React.useCallback((event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(data);
    }, [data, onSelect]);

    const handlePointerOver = React.useCallback((event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setHovered(true);
    }, []);

    const handlePointerOut = React.useCallback((event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setHovered(false);
    }, []);

    return (
        <group position={position} visible={visible}>
            <Sphere
                args={[0.03, 16, 16]}
                onClick={handleSphereClick}
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
            >
                <meshStandardMaterial
                    color={hovered ? cyberTheme.colors.cyberCyanBright : cyberTheme.colors.pointLight}
                    emissive={hovered ? cyberTheme.colors.cyberCyanBright : cyberTheme.colors.pointLight}
                    emissiveIntensity={hovered ? 0.8 : 0.5}
                    toneMapped={false}
                />
            </Sphere>
        </group>
    );
});

// Helper function to convert lat/lon to 3D coordinates
const latLonToVector3 = (lat: number, lon: number, radius: number): [number, number, number] => {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);

    return [x, y, z];
};

// --- GeoJSON Line Components ---
interface LineFeatureProps {
    geoJson: GeoJsonFeatureCollection;
    radius: number;
    color: Color;
    opacity: number;
    lineWidth?: number;
}

const GeoJsonLines = React.memo<LineFeatureProps>(function GeoJsonLines({ geoJson, radius, color, opacity, lineWidth = 1 }) {
    const lines = useMemo(() => {
        if (!geoJson || !geoJson.features) return [];

        const extractedLines: Vector3[][] = [];
        geoJson.features.forEach((feature: GeoJsonFeature) => {
            const { type, coordinates } = feature.geometry;
            const processCoordinates = (coords: number[][]) => { // Process a single line of coordinates
                return coords.map((coord: number[]) => {
                    const [x, y, z] = latLonToVector3(coord[1], coord[0], radius + 0.001);
                    return new Vector3(x, y, z);
                });
            };

            if (type === "Polygon") {
                const polygonCoords = coordinates as number[][][];
                extractedLines.push(processCoordinates(polygonCoords[0]));
            } else if (type === "MultiPolygon") {
                const multiPolygonCoords = coordinates as number[][][][];
                multiPolygonCoords.forEach(polygon => {
                    extractedLines.push(processCoordinates(polygon[0]));
                });
            } else if (type === "LineString") {
                const lineStringCoords = coordinates as number[][];
                extractedLines.push(processCoordinates(lineStringCoords));
            } else if (type === "MultiLineString") {
                const multiLineStringCoords = coordinates as number[][][];
                multiLineStringCoords.forEach(lineString => {
                    extractedLines.push(processCoordinates(lineString));
                });
            }
        });
        return extractedLines;
    }, [geoJson, radius]);

    return (
        <group>
            {lines.map((points, index) => (
                <Line
                    key={index}
                    points={points}
                    color={color}
                    lineWidth={lineWidth}
                    transparent
                    opacity={opacity}
                />
            ))}
        </group>
    );
});
// --- End GeoJSON Line Components ---

interface TimelineFilter {
    startTime: Date;
    endTime: Date;
}

const Globe = React.memo<{
    onSelectReport: (report: NewsMarkerData) => void;
    timelineFilter?: TimelineFilter;
    onReportsLoaded?: (reports: NewsMarkerData[]) => void;
    onReportsMeta?: (start: Date, end: Date) => void;
}>(function Globe({ onSelectReport, timelineFilter, onReportsLoaded, onReportsMeta }) {
    const globeRef = useRef<Mesh>(null!);
    const [countryBordersData, setCountryBordersData] = useState<GeoJsonFeatureCollection | null>(null);
    const [coastlinesData, setCoastlinesData] = useState<GeoJsonFeatureCollection | null>(null);
    const [newsItems, setNewsItems] = useState<NewsMarkerData[]>([]);
    const [isFetchingGeoData, setIsFetchingGeoData] = useState<boolean>(true); // Track GeoJSON loading

    useEffect(() => {
        const fetchGeoData = async () => {
            setIsFetchingGeoData(true); // Start loading GeoJSON
            try {
                // Fetch borders data (essential)
                const bordersResponse = await fetch('/geojson/ne_110m_admin_0_countries.geojson');
                if (!bordersResponse.ok) {
                    console.error(`Failed to fetch essential borders: ${bordersResponse.status}`);
                    throw new Error(`Failed to fetch borders: ${bordersResponse.status}`);
                }
                const bordersJson = await bordersResponse.json() as GeoJsonFeatureCollection;
                setCountryBordersData(bordersJson);

                // Fetch coastlines data (optional)
                try {
                    const coastlinesResponse = await fetch('/geojson/ne_110m_coastline.geojson');
                    if (coastlinesResponse.ok) {
                        const coastlinesJson = await coastlinesResponse.json() as GeoJsonFeatureCollection;
                        setCoastlinesData(coastlinesJson);
                    } else {
                        // Optional coastline data unavailable; continue without it
                    }
                } catch {
                    // Ignore optional coastline errors
                }

            } catch (error) {
                // Handle critical errors (like failed borders fetch)
                console.error("Error fetching critical GeoJSON data:", error);
                // Potentially set an error state here to inform the user
            } finally {
                setIsFetchingGeoData(false); // Finish loading GeoJSON
            }
        };

        const fetchAndProcessNews = async () => {
            setNewsItems([]);
            const processedReports: NewsMarkerData[] = [];
            try {
                const now = new Date();
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                const response = await fetch(`/api/reports?start=${encodeURIComponent(weekAgo.toISOString())}&end=${encodeURIComponent(now.toISOString())}`);
                if (!response.ok) {
                    console.error(`Failed to fetch reports: ${response.status}`);
                    return;
                }
                const reports: ReportFromAPI[] = await response.json();
                const allReports = reports;

                // 1) Immediately add any reports that already have coordinates from the API
                const withCoords = allReports.filter(r => typeof r.lat === 'number' && typeof r.lon === 'number' && r.lat !== 0 && r.lon !== 0);
                if (withCoords.length) {
                    const initial = withCoords.map(r => ({
                        ...r,
                        lat: r.lat as number,
                        lon: r.lon as number,
                        generatedAtMs: new Date(r.generatedAt).getTime(),
                    } as NewsMarkerData));
                    processedReports.push(...initial);
                    setNewsItems(prev => [...prev, ...initial]);
                }

                // 2) Build city index only for reports missing coords
                const missing = allReports.filter(r => !(typeof r.lat === 'number' && typeof r.lon === 'number' && r.lat !== 0 && r.lon !== 0));
                const cityIndex = new Map<string, ReportFromAPI[]>();
                for (const r of missing) {
                    if (!r.city) continue;
                    const key = r.city.trim().toLowerCase().replace(/\s+/g, ' ');
                    const arr = cityIndex.get(key) || [];
                    arr.push(r);
                    cityIndex.set(key, arr);
                }

                // Notify parent with time bounds immediately to enable timeline
                if (onReportsMeta && allReports.length > 0) {
                    const times = allReports.map(r => new Date(r.generatedAt).getTime()).filter(t => !isNaN(t));
                    const latestMs = Math.max(...times);
                    const latestTime = new Date(latestMs);
                    const weekStart = new Date(latestMs - 7 * 24 * 60 * 60 * 1000);
                    onReportsMeta(weekStart, latestTime);
                }

                // Geocode with limited concurrency (respect OSM Nominatim policy)
                const concurrency = 3;
                let index = 0;

                const runWorker = async () => {
                    const cityKeys = Array.from(cityIndex.keys());
                    while (index < cityKeys.length) {
                        const i = index++;
                        const key = cityKeys[i];
                        const cityReports = cityIndex.get(key) || [];
                        const sample = cityReports[0];
                        if (!sample || !sample.city) continue;
                        try {
                            const geoResponse = await fetch(`/api/geocode?city=${encodeURIComponent(sample.city)}`);
                            if (!geoResponse.ok) {
                                await geoResponse.json().catch(() => null);
                                continue;
                            }
                            const location: { lat: number; lng: number; country?: string; country_code?: string; display_name?: string } = await geoResponse.json();
                            if (typeof location.lat === 'number' && typeof location.lng === 'number' && !(location.lat === 0 && location.lng === 0)) {
                                for (const report of cityReports) {
                                    const newItem: NewsMarkerData = {
                                        ...report,
                                        lat: location.lat,
                                        lon: location.lng,
                                        country: location.country,
                                        country_code: location.country_code,
                                        display_name: location.display_name,
                                        generatedAtMs: new Date(report.generatedAt).getTime(),
                                    };
                                    processedReports.push(newItem);
                                    if (processedReports.length % 25 === 0) {
                                        setNewsItems(prev => [...prev, ...processedReports.splice(0, processedReports.length)]);
                                    }
                                }
                            }
                        } catch {
                            // Ignore errors per item
                        }
                    }
                };

                const workers = Array.from({ length: concurrency }, () => runWorker());
                await Promise.all(workers);
                if (processedReports.length) {
                    setNewsItems(prev => [...prev, ...processedReports.splice(0, processedReports.length)]);
                }

                // Call the callback with all processed reports
                if (onReportsLoaded && processedReports.length > 0) {
                    onReportsLoaded(processedReports);
                }
            } catch (error) {
                console.error("Error fetching or processing news data:", error);
            }
        };

        fetchGeoData(); // Fetch borders/coastlines
        fetchAndProcessNews(); // Start fetching news in parallel
    }, [onReportsLoaded, onReportsMeta]); // Run once on mount

    useFrame(() => {
        if (globeRef.current) {
            // globeRef.current.rotation.y += 0.001;
        }
    });

    const globeRadius = 2; // Radius of the globe

    // Precompute and memoize stable positions so markers don't re-render unnecessarily
    const markerPositions = useMemo(() => {
        const map = new Map<string, [number, number, number]>();
        for (const news of newsItems) {
            map.set(news.reportId, latLonToVector3(news.lat, news.lon, globeRadius + 0.01));
        }
        return map;
    }, [newsItems]);

    const markers = useMemo(() => {
        return newsItems.map((news: NewsMarkerData) => {
            const position = markerPositions.get(news.reportId)!;

            // Determine if this marker should be visible based on timeline filter
            let isVisible = true;
            if (timelineFilter) {
                const t = news.generatedAtMs ?? new Date(news.generatedAt).getTime();
                isVisible = t >= timelineFilter.startTime.getTime() && t <= timelineFilter.endTime.getTime();
            }

            return (
                <Marker
                    key={news.reportId}
                    position={position}
                    data={news}
                    onSelect={onSelectReport}
                    visible={isVisible}
                />
            );
        });
    }, [newsItems, onSelectReport, timelineFilter, markerPositions]);

    // Optional: Render a subtle loading indicator for GeoJSON if needed
    if (isFetchingGeoData) {
        return (
            <Html center>
                <div className="text-center space-y-4">
                    <Skeleton className="h-8 w-48 mx-auto" />
                    <Skeleton className="h-4 w-64 mx-auto" />
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </div>
            </Html>
        );
    }

    return (
        <>
            <ambientLight color={cyberTheme.colors.ambientLight} intensity={0.3} />
            <Sphere ref={globeRef} args={[globeRadius, 64, 64]}>
                <meshPhongMaterial
                    color={cyberTheme.colors.earthBase}
                    emissive={cyberTheme.colors.earthEmissive}
                    specular={cyberTheme.colors.earthSpecular}
                    shininess={20}
                    transparent
                    opacity={cyberTheme.opacity.earthOpacity}
                />
            </Sphere>
            {markers}
            {countryBordersData && (
                <GeoJsonLines
                    geoJson={countryBordersData}
                    radius={globeRadius}
                    color={cyberTheme.colors.cyberCyan}
                    opacity={cyberTheme.opacity.countryBordersOpacity}
                    lineWidth={0.5} // Thinner lines for borders
                />
            )}
            {coastlinesData && (
                <GeoJsonLines
                    geoJson={coastlinesData}
                    radius={globeRadius}
                    color={cyberTheme.colors.cyberCyanBright}
                    opacity={cyberTheme.opacity.coastlinesOpacity}
                    lineWidth={1} // Slightly thicker for coastlines
                />
            )}
            <OrbitControls enableZoom={true} enablePan={true} minDistance={2.2} maxDistance={15} />
        </>
    );
});

const NewsGlobe: React.FC = () => {
    const [selectedReport, setSelectedReport] = useState<NewsMarkerData | null>(null);
    const [allReports, setAllReports] = useState<NewsMarkerData[]>([]);
    const [timeRange, setTimeRange] = useState<{ start: Date; end: Date } | null>(null);
    const [currentTimeWindow, setCurrentTimeWindow] = useState<{ start: Date; end: Date } | null>(null);
    // removed: initialized flag (unused)
    const [userAdjustedWindow, setUserAdjustedWindow] = useState<boolean>(false);
    const [timelineReady, setTimelineReady] = useState<boolean>(false);

    const handleSelectReport = React.useCallback((report: NewsMarkerData) => {
        setSelectedReport(report);
    }, []);

    const handleCloseReport = React.useCallback(() => {
        setSelectedReport(null);
    }, []);

    // Initial timeline: show last week immediately while data loads
    useEffect(() => {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
        const start = sixHoursAgo > weekAgo ? sixHoursAgo : weekAgo;
        setTimeRange({ start: weekAgo, end: now });
        setCurrentTimeWindow({ start, end: now });
    }, []);

    // Set up time ranges when reports are loaded
    useEffect(() => {
        if (allReports.length > 0) {
            const times = allReports.map(r => (r.generatedAtMs ?? new Date(r.generatedAt).getTime()));
            const latestMs = Math.max(...times);
            const latestTime = new Date(latestMs);
            const weekAgo = new Date(latestMs - 7 * 24 * 60 * 60 * 1000);

            setTimeRange({ start: weekAgo, end: latestTime });

            // Initial window: last 6 hours within the week
            const sixHoursAgo = new Date(latestMs - 6 * 60 * 60 * 1000);
            const windowStart = sixHoursAgo > weekAgo ? sixHoursAgo : weekAgo;
            if (!userAdjustedWindow) {
                setCurrentTimeWindow({ start: windowStart, end: latestTime });
            }
        }
    }, [allReports, userAdjustedWindow]);

    const handleTimeRangeChange = useCallback((start: Date, end: Date) => {
        setCurrentTimeWindow({ start, end });
        setUserAdjustedWindow(true);
    }, []);

    const timelineFilter = currentTimeWindow ? {
        startTime: currentTimeWindow.start,
        endTime: currentTimeWindow.end
    } : undefined;

  const handleReportsLoaded = useCallback((reports: NewsMarkerData[]) => {
      setAllReports(reports);
  }, []);

  const handleReportsMeta = useCallback((start: Date, end: Date) => {
      setTimeRange({ start, end });
      if (!userAdjustedWindow) {
          const sixHoursAgo = new Date(end.getTime() - 6 * 60 * 60 * 1000);
          const ws = sixHoursAgo > start ? sixHoursAgo : start;
          setCurrentTimeWindow({ start: ws, end });
      }
      setTimelineReady(true);
  }, [userAdjustedWindow]);

    return (
        <div className="relative h-screen w-full bg-[#000010] overflow-hidden">
            {/* Brain logo - positioned outside the translating container */}
            <Link
                href="/"
                className={`absolute top-5 left-5 z-10 transition-opacity duration-500 ${selectedReport ? 'md:opacity-100 opacity-0' : 'opacity-100'
                    }`}
            >
                <Image src="/images/brain_transparent.png" alt="Return to homepage" width={32} height={32} />
            </Link>

            <div className="flex w-full h-full">
                <div
                    className="relative w-full transition-transform duration-500 ease-in-out"
                    style={{ transform: selectedReport ? 'translateX(-25%)' : 'translateX(0)' }}
                >
                    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                        <Globe
                            onSelectReport={handleSelectReport}
                            timelineFilter={timelineFilter}
                            onReportsLoaded={handleReportsLoaded}
                            onReportsMeta={handleReportsMeta}
                        />
                    </Canvas>
                </div>

                {/* Panel - Always render but translate out when not selected */}
                <div
                    className={`fixed md:absolute top-0 right-0 h-full w-full md:w-2/5 transition-transform duration-500 ease-in-out ${!selectedReport ? 'pointer-events-none' : ''
                        }`}
                    style={{ transform: `translateX(${selectedReport ? '0' : '100%'})` }}
                >
                    {selectedReport && (
                        <>
                            {/* Mobile overlay */}
                            <div className="md:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-10" />

                            {/* Panel container with higher z-index */}
                            <div className="relative h-full z-20">
                                <ReportPanel
                                    report={selectedReport}
                                    onClose={handleCloseReport}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Timeline at the bottom */}
            {timeRange && currentTimeWindow && (
                <div className="absolute bottom-0 left-0 right-0 z-30">
                    <Timeline
                        startTime={timeRange.start}
                        endTime={timeRange.end}
                        currentStart={currentTimeWindow.start}
                        currentEnd={currentTimeWindow.end}
                        onTimeRangeChange={handleTimeRangeChange}
                        disabled={!timelineReady}
                    />
                </div>
            )}
        </div>
    );
};

export default React.memo(NewsGlobe); 
