'use client';

import { formatTime } from '@/lib/utils';
import { Html, Line, OrbitControls, Sphere } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from './ui/button';
import { Slider } from './ui/slider';

// --- Theme Configuration (Simplified from example) ---
const cyberTheme = {
    colors: {
        earthBase: new THREE.Color(0x001020),
        earthEmissive: new THREE.Color(0x003355), // Slightly lighter blue emissive
        earthSpecular: new THREE.Color(0x88aaff), // Bluish specular
        ambientLight: new THREE.Color(0x404040),
        directionalLight: new THREE.Color(0x00aaff),
        pointLight: new THREE.Color(0x00ffff),    // Cyan point light
        cyberCyan: new THREE.Color(0x00ffff),        // Bright cyan for borders
        cyberCyanBright: new THREE.Color(0x88ffff), // Lighter cyan for coastlines
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
}

interface MarkerProps {
    position: [number, number, number];
    data: NewsMarkerData;
}

const Marker: React.FC<MarkerProps> = ({ position, data }: MarkerProps) => {
    const [hovered, setHovered] = React.useState(false);
    const [active, setActive] = React.useState(false);
    const popupRef = React.useRef<HTMLDivElement>(null);

    const handleSphereClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        setActive(prev => !prev);
    };

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (active && popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setActive(false);
            }
        };

        if (active) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [active]);

    return (
        <group position={position}>
            <Sphere
                args={[0.03, 16, 16]} // Small sphere for the marker
                onClick={handleSphereClick}
                onPointerOver={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); setHovered(true); }}
                onPointerOut={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); setHovered(false); }}
            >
                <meshStandardMaterial
                    color={hovered ? cyberTheme.colors.cyberCyanBright : cyberTheme.colors.pointLight}
                    emissive={hovered ? cyberTheme.colors.cyberCyanBright : cyberTheme.colors.pointLight}
                    emissiveIntensity={hovered ? 0.8 : 0.5}
                    toneMapped={false} // Optional: to make emissive colors pop more, depending on post-processing
                />
            </Sphere>
            {active && (
                <Html distanceFactor={5} center pointerEvents="none">
                    <div
                        ref={popupRef}
                        // Stop propagation for clicks/pointer events originating inside the popup,
                        // so they don't trigger the handleClickOutside listener.
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()} // Handles touch and mouse primary actions
                        style={{
                            background: 'rgba(0, 0, 0, 0.8)', // Slightly more opaque
                            color: 'white',
                            padding: '8px 12px',
                            borderRadius: '5px',
                            fontSize: '13px',
                            minWidth: '220px', // Slightly wider
                            textAlign: 'left',
                            border: `1px solid ${cyberTheme.colors.cyberCyan.getHexString()}`, // Themed border
                            boxShadow: `0 0 10px ${cyberTheme.colors.cyberCyan.getHexString()}`, // Subtle glow
                            cursor: 'default', // Indicate it's content, not draggable
                        }}
                    >
                        <h4 style={{ color: cyberTheme.colors.cyberCyanBright.getHexString() }}>
                            {data.headline}
                        </h4>
                        <p className="text-muted-foreground text-xs my-1">
                            {formatTime(data?.generatedAt, true)} - {data?.city}
                        </p>
                        <p style={{ margin: 0 }}>{data.body.substring(0, 200) + (data.body.length > 200 ? '...' : '')}</p>
                        <Link href={`/current-events/${data.channelId}/${data.reportId}`}>
                            <Button variant="outline" size="sm" className="mt-2 w-full">
                                View Report
                            </Button>
                        </Link>
                    </div>
                </Html>
            )}
        </group>
    );
};

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
    color: THREE.Color;
    opacity: number;
    lineWidth?: number;
}

const GeoJsonLines: React.FC<LineFeatureProps> = ({ geoJson, radius, color, opacity, lineWidth = 1 }: LineFeatureProps) => {
    const lines = useMemo(() => {
        if (!geoJson || !geoJson.features) return [];

        const extractedLines: THREE.Vector3[][] = [];
        geoJson.features.forEach((feature: GeoJsonFeature) => {
            const { type, coordinates } = feature.geometry;
            const processCoordinates = (coords: number[][]) => { // Process a single line of coordinates
                return coords.map((coord: number[]) => {
                    const [x, y, z] = latLonToVector3(coord[1], coord[0], radius + 0.001);
                    return new THREE.Vector3(x, y, z);
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
};
// --- End GeoJSON Line Components ---

interface GlobeProps {
    timelineValue: number;
    onTimeRangeChange: (range: { min: Date; max: Date }) => void;
}

const Globe: React.FC<GlobeProps> = ({ timelineValue, onTimeRangeChange }): React.ReactNode => {
    const globeRef = useRef<THREE.Mesh>(null!);
    const [countryBordersData, setCountryBordersData] = useState<GeoJsonFeatureCollection | null>(null);
    const [coastlinesData, setCoastlinesData] = useState<GeoJsonFeatureCollection | null>(null);
    const [newsItems, setNewsItems] = useState<NewsMarkerData[]>([]);
    const [allNewsItems, setAllNewsItems] = useState<NewsMarkerData[]>([]);
    const [isFetchingGeoData, setIsFetchingGeoData] = useState<boolean>(true);
    const [timeRange, setTimeRange] = useState<{ min: Date; max: Date }>({ min: new Date(), max: new Date() });

    // Fetch geo data and news
    useEffect(() => {
        const fetchGeoData = async () => {
            setIsFetchingGeoData(true);
            try {
                const bordersResponse = await fetch('/geojson/ne_110m_admin_0_countries.geojson');
                if (!bordersResponse.ok) {
                    console.error(`Failed to fetch essential borders: ${bordersResponse.status}`);
                    throw new Error(`Failed to fetch borders: ${bordersResponse.status}`);
                }
                const bordersJson = await bordersResponse.json();
                setCountryBordersData(bordersJson);

                try {
                    const coastlinesResponse = await fetch('/geojson/ne_110m_coastline.geojson');
                    if (coastlinesResponse.ok) {
                        const coastlinesJson = await coastlinesResponse.json();
                        setCoastlinesData(coastlinesJson);
                    } else {
                        if (coastlinesResponse.status === 429) {
                            console.warn('Coastline data temporarily unavailable due to rate limiting (429). Globe will display without coastlines.');
                        } else {
                            console.warn(`Failed to fetch coastlines: ${coastlinesResponse.status}. Globe will display without coastlines.`);
                        }
                    }
                } catch (coastlineError) {
                    console.warn("Error fetching optional coastline data:", coastlineError);
                }
            } catch (error) {
                console.error("Error fetching critical GeoJSON data:", error);
            } finally {
                setIsFetchingGeoData(false);
            }
        };

        const fetchAndProcessNews = async () => {
            setNewsItems([]);
            setAllNewsItems([]);
            try {
                const response = await fetch('/api/reports');
                if (!response.ok) {
                    console.error(`Failed to fetch reports: ${response.status}`);
                    return;
                }
                const reports: ReportFromAPI[] = await response.json();

                const limitedReports = reports.slice(0, 20);
                console.log(`Processing up to ${limitedReports.length} out of ${reports.length} total reports`);

                const processedItems: NewsMarkerData[] = [];

                // Process reports one by one
                for (const report of limitedReports) {
                    if (!report.city || !report.headline || !report.body || !report.reportId) {
                        console.warn('Report missing critical fields (city, headline, body, or reportId), skipping:', report);
                        continue;
                    }
                    try {
                        const geoResponse = await fetch(
                            `/api/geocode?city=${encodeURIComponent(report.city)}`
                        );

                        if (!geoResponse.ok) {
                            const errorData = await geoResponse.json().catch(() => ({ error: "Failed to parse error response from geocode API" }));
                            console.warn(
                                `Error fetching geocoded data for ${report.city} (Report ID: ${report.reportId}): ${geoResponse.status}`,
                                errorData?.error || geoResponse.statusText
                            );
                            continue;
                        }

                        const location: { lat: number; lng: number } = await geoResponse.json();

                        if (typeof location.lat === 'number' && typeof location.lng === 'number' && !(location.lat === 0 && location.lng === 0)) {
                            // Add successfully geocoded item
                            const newItem: NewsMarkerData = {
                                ...report,
                                lat: location.lat,
                                lon: location.lng,
                            };
                            processedItems.push(newItem);
                        } else {
                            console.warn(`No valid geocoding results for ${report.city} (Report ID: ${report.reportId}). API might have returned no location or placeholder.`);
                        }
                    } catch (geoError) {
                        console.warn(`Error during geocoding process for ${report.city} (Report ID: ${report.reportId}):`, geoError);
                    }
                }

                // Update time range based on all items
                if (processedItems.length > 0) {
                    const dates = processedItems.map(item => new Date(item.generatedAt));
                    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                    setTimeRange({ min: minDate, max: maxDate });
                    onTimeRangeChange({ min: minDate, max: maxDate });
                }

                setAllNewsItems(processedItems);
                setNewsItems(processedItems);
                console.log(`Finished processing reports. Displaying ${processedItems.length} markers.`);
            } catch (error) {
                console.error("Error fetching or processing news data:", error);
            }
        };

        fetchGeoData();
        fetchAndProcessNews();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Filter news items based on timeline value
    useEffect(() => {
        if (allNewsItems.length === 0) return;

        const timeRangeInMs = timeRange.max.getTime() - timeRange.min.getTime();
        const selectedTime = timeRange.min.getTime() + (timeRangeInMs * (timelineValue / 100));

        const filteredItems = allNewsItems.filter(item => {
            const itemTime = new Date(item.generatedAt).getTime();
            return itemTime <= selectedTime;
        });

        setNewsItems(filteredItems);
    }, [timelineValue, allNewsItems, timeRange]);

    useFrame(() => {
        if (globeRef.current) {
            // globeRef.current.rotation.y += 0.001;
        }
    });

    const globeRadius = 2; // Radius of the globe

    const markers = useMemo(() => {
        return newsItems.map((news: NewsMarkerData) => {
            const position = latLonToVector3(news.lat, news.lon, globeRadius + 0.01);
            return <Marker key={news.reportId} position={position} data={news} />;
        });
    }, [newsItems]);

    // Optional: Render a subtle loading indicator for GeoJSON if needed
    if (isFetchingGeoData) {
        return (
            <Html center>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                    lineWidth={0.5}
                />
            )}
            {coastlinesData && (
                <GeoJsonLines
                    geoJson={coastlinesData}
                    radius={globeRadius}
                    color={cyberTheme.colors.cyberCyanBright}
                    opacity={cyberTheme.opacity.coastlinesOpacity}
                    lineWidth={1}
                />
            )}
            <OrbitControls enableZoom={true} enablePan={true} minDistance={2.2} maxDistance={15} />
        </>
    );
};

const NewsGlobe: React.FC = () => {
    const [timelineValue, setTimelineValue] = useState<number>(100);
    const [timeRange, setTimeRange] = useState<{ min: Date; max: Date }>({ min: new Date(), max: new Date() });

    // Calculate current date based on timeline value
    const currentDate = useMemo(() => {
        const timeRangeInMs = timeRange.max.getTime() - timeRange.min.getTime();
        const selectedTime = timeRange.min.getTime() + (timeRangeInMs * (timelineValue / 100));
        return new Date(selectedTime);
    }, [timelineValue, timeRange]);

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%', background: '#000010' }}>
            <Link href="/" style={{ position: 'absolute', top: '20px', left: '20px', zIndex: 10 }}>
                <Image src="/images/brain_transparent.png" alt="Home" width={32} height={32} />
            </Link>
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <Globe timelineValue={timelineValue} onTimeRangeChange={setTimeRange} />
            </Canvas>
            <div style={{
                position: 'absolute',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '80%',
                maxWidth: '600px',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 255, 255, 0.2)',
                zIndex: 10,
            }}>
                <div className="text-center mb-4 text-cyan-300">
                    {formatTime(currentDate.toISOString(), true)}
                </div>
                <Slider
                    defaultValue={[100]}
                    max={100}
                    step={1}
                    value={[timelineValue]}
                    onValueChange={(value) => setTimelineValue(value[0])}
                    className="w-full"
                />
                <div className="flex justify-between mt-2 text-xs text-cyan-300">
                    <span>{formatTime(timeRange.min.toISOString(), true)}</span>
                    <span>{formatTime(timeRange.max.toISOString(), true)}</span>
                </div>
            </div>
        </div>
    );
};

export default NewsGlobe; 