'use client';

import { ReportPanel } from '@/components/ReportPanel';
import { Loader } from '@/components/ui/loader';
import { Html, Line, OrbitControls, Sphere } from '@react-three/drei';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

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
    onSelect: (data: NewsMarkerData) => void;
}

const Marker: React.FC<MarkerProps> = ({ position, data, onSelect }: MarkerProps) => {
    const [hovered, setHovered] = React.useState(false);

    const handleSphereClick = (event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        onSelect(data);
    };

    return (
        <group position={position}>
            <Sphere
                args={[0.03, 16, 16]}
                onClick={handleSphereClick}
                onPointerOver={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); setHovered(true); }}
                onPointerOut={(event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); setHovered(false); }}
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

const Globe = ({ onSelectReport }: { onSelectReport: (report: NewsMarkerData) => void }): React.ReactNode => {
    const globeRef = useRef<THREE.Mesh>(null!);
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
                const bordersJson = await bordersResponse.json();
                setCountryBordersData(bordersJson);

                // Fetch coastlines data (optional)
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
                // Handle critical errors (like failed borders fetch)
                console.error("Error fetching critical GeoJSON data:", error);
                // Potentially set an error state here to inform the user
            } finally {
                setIsFetchingGeoData(false); // Finish loading GeoJSON
            }
        };

        const fetchAndProcessNews = async () => {
            setNewsItems([]);
            try {
                const response = await fetch('/api/reports?limit=20');
                if (!response.ok) {
                    console.error(`Failed to fetch reports: ${response.status}`);
                    return;
                }
                const reports: ReportFromAPI[] = await response.json();

                const limitedReports = reports.slice(0, 20);
                console.log(`Processing up to ${limitedReports.length} out of ${reports.length} total reports`);

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
                            console.warn( // Use warn as it's non-blocking for other markers
                                `Error fetching geocoded data for ${report.city} (Report ID: ${report.reportId}): ${geoResponse.status}`,
                                errorData?.error || geoResponse.statusText
                            );
                            continue;
                        }

                        const location: { lat: number; lng: number } = await geoResponse.json();

                        if (typeof location.lat === 'number' && typeof location.lng === 'number' && !(location.lat === 0 && location.lng === 0)) {
                            // Add successfully geocoded item to state immediately
                            const newItem: NewsMarkerData = {
                                ...report,
                                lat: location.lat,
                                lon: location.lng,
                            };
                            setNewsItems(prevItems => [...prevItems, newItem]);
                        } else {
                            console.warn(`No valid geocoding results for ${report.city} (Report ID: ${report.reportId}). API might have returned no location or placeholder.`);
                        }
                    } catch (geoError) {
                        console.warn(`Error during geocoding process for ${report.city} (Report ID: ${report.reportId}):`, geoError);
                    }
                }
                console.log(`Finished processing reports. Total reports processed: ${limitedReports.length}`);
            } catch (error) {
                console.error("Error fetching or processing news data:", error);
            }
        };

        fetchGeoData(); // Fetch borders/coastlines
        fetchAndProcessNews(); // Start fetching news in parallel
    }, []); // Run once on mount

    useFrame(() => {
        if (globeRef.current) {
            // globeRef.current.rotation.y += 0.001;
        }
    });

    const globeRadius = 2; // Radius of the globe

    const markers = useMemo(() => {
        return newsItems.map((news: NewsMarkerData) => {
            const position = latLonToVector3(news.lat, news.lon, globeRadius + 0.01);
            return <Marker key={news.reportId} position={position} data={news} onSelect={onSelectReport} />;
        });
    }, [newsItems, onSelectReport]);

    // Optional: Render a subtle loading indicator for GeoJSON if needed
    if (isFetchingGeoData) {
        return (
            <Html center>
                <Loader size="lg" className="text-muted-foreground" />
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
};

const NewsGlobe: React.FC = () => {
    const [selectedReport, setSelectedReport] = useState<NewsMarkerData | null>(null);

    return (
        <div className="relative h-screen w-full bg-[#000010] overflow-hidden">
            {/* Brain logo - positioned outside the translating container */}
            <Link
                href="/"
                className={`absolute top-5 left-5 z-10 transition-opacity duration-500 ${selectedReport ? 'md:opacity-100 opacity-0' : 'opacity-100'
                    }`}
            >
                <Image src="/images/brain_transparent.webp" alt="Home" width={32} height={32} />
            </Link>

            <div className="flex w-full h-full">
                <div
                    className="relative w-full transition-transform duration-500 ease-in-out"
                    style={{ transform: selectedReport ? 'translateX(-25%)' : 'translateX(0)' }}
                >
                    <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                        <Globe onSelectReport={setSelectedReport} />
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
                                    onClose={() => setSelectedReport(null)}
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsGlobe; 