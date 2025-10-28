import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { WindDataPoint } from '@/lib/types/weather';

interface Props {
  windData: WindDataPoint[];
  globeRadius: number;
  visible?: boolean;
}

// Helper to convert lat/lon to 3D coordinates (same as NewsGlobe)
const latLonToVector3 = (lat: number, lon: number, radius: number): THREE.Vector3 => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
};

// Find nearest wind data point for a given lat/lon
const findNearestWind = (lat: number, lon: number, windData: WindDataPoint[]): WindDataPoint | null => {
  if (windData.length === 0) return null;

  let nearest: WindDataPoint | null = null;
  let minDist = Infinity;

  for (const point of windData) {
    // Simple Euclidean distance (good enough for grid data)
    const dist = Math.sqrt((point.lat - lat) ** 2 + (point.lon - lon) ** 2);
    if (dist < minDist) {
      minDist = dist;
      nearest = point;
    }
  }

  return nearest;
};

// Convert wind direction (degrees) to tangent velocity vector on sphere
const windToVelocity = (
  position: THREE.Vector3,
  windSpeed: number,
  windDirection: number
): THREE.Vector3 => {
  // Wind direction: 0° = North, 90° = East, 180° = South, 270° = West
  // Convert to velocity in local tangent space

  // Get the "up" vector (away from globe center)
  const up = position.clone().normalize();

  // Get east vector (tangent to sphere, pointing east)
  const north = new THREE.Vector3(0, 1, 0);
  const east = new THREE.Vector3().crossVectors(north, up).normalize();

  // If we're too close to poles, use a different reference
  if (east.length() < 0.1) {
    const fallbackNorth = new THREE.Vector3(0, 0, 1);
    east.crossVectors(fallbackNorth, up).normalize();
  }

  // Get north vector (tangent to sphere, pointing north)
  const actualNorth = new THREE.Vector3().crossVectors(up, east).normalize();

  // Convert wind direction to radians (clockwise from north)
  const dirRad = windDirection * (Math.PI / 180);

  // Calculate velocity components - increased speed for better visibility
  const speedScale = 0.001; // Doubled from 0.0005 for more fluid motion
  const scaledSpeed = windSpeed * speedScale;

  // Wind blows FROM the direction specified, so we need to reverse
  const northComponent = -Math.cos(dirRad) * scaledSpeed;
  const eastComponent = -Math.sin(dirRad) * scaledSpeed;

  // Combine into final velocity vector
  const velocity = new THREE.Vector3();
  velocity.addScaledVector(actualNorth, northComponent);
  velocity.addScaledVector(east, eastComponent);

  return velocity;
};

// Get color based on wind speed with smooth interpolation
const getSpeedColor = (speed: number): THREE.Color => {
  if (speed < 5) {
    // Slow: Blue to Cyan (0-5 m/s)
    const t = speed / 5;
    return new THREE.Color(0, 0.5 * t, 1);
  } else if (speed < 10) {
    // Medium: Cyan to Green (5-10 m/s)
    const t = (speed - 5) / 5;
    return new THREE.Color(0, 0.5 + 0.5 * t, 1 - t);
  } else if (speed < 15) {
    // Medium-Fast: Green to Yellow (10-15 m/s)
    const t = (speed - 10) / 5;
    return new THREE.Color(t, 1, 0);
  } else {
    // Fast: Yellow to Red (15+ m/s)
    const t = Math.min((speed - 15) / 10, 1);
    return new THREE.Color(1, 1 - t, 0);
  }
};

export function WindParticles({ windData, globeRadius, visible = true }: Props) {
  const linesRef = useRef<THREE.LineSegments>(null);
  const velocitiesRef = useRef<Float32Array | null>(null);
  const agesRef = useRef<Float32Array | null>(null);
  const trailHistoryRef = useRef<Float32Array | null>(null);

  // Initialize particles with trail system
  const { geometry, velocities, ages, trailHistory, particleCount, trailLength } = useMemo(() => {
    const count = 18000; // Increased for better global coverage
    const trailLength = 8; // Number of segments per trail

    // Each particle has trailLength+1 positions (current + history)
    const totalPositions = count * (trailLength + 1);
    const positions = new Float32Array(totalPositions * 3);
    const colors = new Float32Array(totalPositions * 3);
    const alphas = new Float32Array(totalPositions); // For fade-out effect

    const velocities = new Float32Array(count * 3);
    const ages = new Float32Array(count);
    const trailHistory = new Float32Array(count * trailLength * 3); // Store trail positions

    for (let i = 0; i < count; i++) {
      // Random position on globe surface
      const lat = (Math.random() - 0.5) * 180;
      const lon = (Math.random() - 0.5) * 360;
      const heightOffset = 0.1; // Slightly above surface

      const position = latLonToVector3(lat, lon, globeRadius + heightOffset);

      // Initialize all trail segments at the same position
      for (let j = 0; j <= trailLength; j++) {
        const idx = i * (trailLength + 1) + j;
        positions[idx * 3] = position.x;
        positions[idx * 3 + 1] = position.y;
        positions[idx * 3 + 2] = position.z;

        // Fade from head (1.0) to tail (0.0)
        alphas[idx] = 1 - (j / trailLength);
      }

      // Find wind data and set velocity
      const windPoint = findNearestWind(lat, lon, windData);
      if (windPoint) {
        const velocity = windToVelocity(position, windPoint.windSpeed, windPoint.windDirection);
        velocities[i * 3] = velocity.x;
        velocities[i * 3 + 1] = velocity.y;
        velocities[i * 3 + 2] = velocity.z;

        // Set color for entire trail based on speed
        const color = getSpeedColor(windPoint.windSpeed);
        for (let j = 0; j <= trailLength; j++) {
          const idx = i * (trailLength + 1) + j;
          colors[idx * 3] = color.r;
          colors[idx * 3 + 1] = color.g;
          colors[idx * 3 + 2] = color.b;
        }
      } else {
        // No wind data, default to slow drift
        velocities[i * 3] = (Math.random() - 0.5) * 0.0001;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.0001;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.0001;

        // Default to dark blue
        for (let j = 0; j <= trailLength; j++) {
          const idx = i * (trailLength + 1) + j;
          colors[idx * 3] = 0;
          colors[idx * 3 + 1] = 0.3;
          colors[idx * 3 + 2] = 1.0;
        }
      }

      // Random initial age for staggered fading
      ages[i] = Math.random() * 5;
    }

    // Create line segments geometry (each trail is multiple connected segments)
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    return { geometry, velocities, ages, trailHistory, particleCount: count, trailLength };
  }, [windData, globeRadius]);

  // Store refs for animation
  velocitiesRef.current = velocities;
  agesRef.current = ages;
  trailHistoryRef.current = trailHistory;

  // Animate particles with smooth trails
  useFrame((state, delta) => {
    if (!linesRef.current || !velocitiesRef.current || !agesRef.current) return;

    const positions = linesRef.current.geometry.attributes.position.array as Float32Array;
    const colors = linesRef.current.geometry.attributes.color.array as Float32Array;
    const alphas = linesRef.current.geometry.attributes.alpha.array as Float32Array;
    const velocities = velocitiesRef.current;
    const ages = agesRef.current;

    const maxAge = 5; // Shorter lifetime for more dynamic feel
    const respawnRadius = globeRadius + 0.1;
    const fadeStartAge = 3.5; // Start fading before max age

    for (let i = 0; i < particleCount; i++) {
      // Update age
      ages[i] += delta;

      // Get head position (most recent)
      const headIdx = i * (trailLength + 1);

      // Update head position with velocity FIRST
      positions[headIdx * 3] += velocities[i * 3];
      positions[headIdx * 3 + 1] += velocities[i * 3 + 1];
      positions[headIdx * 3 + 2] += velocities[i * 3 + 2];

      // Constrain head to sphere surface
      const pos = new THREE.Vector3(
        positions[headIdx * 3],
        positions[headIdx * 3 + 1],
        positions[headIdx * 3 + 2]
      );
      pos.normalize();
      const targetRadius = globeRadius + 0.1;
      positions[headIdx * 3] = pos.x * targetRadius;
      positions[headIdx * 3 + 1] = pos.y * targetRadius;
      positions[headIdx * 3 + 2] = pos.z * targetRadius;

      // Shift trail positions backward AND constrain each segment to sphere
      for (let j = trailLength; j > 0; j--) {
        const currentIdx = headIdx + j;
        const prevIdx = headIdx + j - 1;

        // Copy previous position
        positions[currentIdx * 3] = positions[prevIdx * 3];
        positions[currentIdx * 3 + 1] = positions[prevIdx * 3 + 1];
        positions[currentIdx * 3 + 2] = positions[prevIdx * 3 + 2];

        // CRITICAL: Constrain trail segment to sphere surface
        const trailPos = new THREE.Vector3(
          positions[currentIdx * 3],
          positions[currentIdx * 3 + 1],
          positions[currentIdx * 3 + 2]
        );
        trailPos.normalize();
        positions[currentIdx * 3] = trailPos.x * targetRadius;
        positions[currentIdx * 3 + 1] = trailPos.y * targetRadius;
        positions[currentIdx * 3 + 2] = trailPos.z * targetRadius;
      }

      // Calculate fade based on age
      const ageFade = ages[i] > fadeStartAge
        ? 1 - ((ages[i] - fadeStartAge) / (maxAge - fadeStartAge))
        : 1;

      // Update alpha values for smooth fade with trail gradient
      for (let j = 0; j <= trailLength; j++) {
        const idx = headIdx + j;
        const trailFade = 1 - (j / trailLength); // 1.0 at head, 0.0 at tail
        alphas[idx] = ageFade * trailFade;
      }

      // Respawn if too old
      const tooOld = ages[i] > maxAge;

      if (tooOld) {
        // Respawn at random location
        const newLat = (Math.random() - 0.5) * 180;
        const newLon = (Math.random() - 0.5) * 360;
        const newPos = latLonToVector3(newLat, newLon, respawnRadius);

        // Reset all trail positions to new spawn point
        for (let j = 0; j <= trailLength; j++) {
          const idx = headIdx + j;
          positions[idx * 3] = newPos.x;
          positions[idx * 3 + 1] = newPos.y;
          positions[idx * 3 + 2] = newPos.z;
          alphas[idx] = 1 - (j / trailLength);
        }

        // Update velocity for new position
        const windPoint = findNearestWind(newLat, newLon, windData);
        if (windPoint) {
          const velocity = windToVelocity(newPos, windPoint.windSpeed, windPoint.windDirection);
          velocities[i * 3] = velocity.x;
          velocities[i * 3 + 1] = velocity.y;
          velocities[i * 3 + 2] = velocity.z;

          // Update color for entire trail
          const color = getSpeedColor(windPoint.windSpeed);
          for (let j = 0; j <= trailLength; j++) {
            const idx = headIdx + j;
            colors[idx * 3] = color.r;
            colors[idx * 3 + 1] = color.g;
            colors[idx * 3 + 2] = color.b;
          }
        }

        ages[i] = 0;
      }
    }

    linesRef.current.geometry.attributes.position.needsUpdate = true;
    linesRef.current.geometry.attributes.alpha.needsUpdate = true;
  });

  // Create line segments indices for trail rendering
  const indices = useMemo(() => {
    const indicesArray: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      const baseIdx = i * (trailLength + 1);

      // Create line segments connecting trail points
      for (let j = 0; j < trailLength; j++) {
        indicesArray.push(baseIdx + j);
        indicesArray.push(baseIdx + j + 1);
      }
    }

    return new Uint32Array(indicesArray);
  }, [particleCount, trailLength]);

  return (
    <lineSegments ref={linesRef} visible={visible}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[geometry.attributes.position.array, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[geometry.attributes.color.array, 3]}
        />
        <bufferAttribute
          attach="attributes-alpha"
          args={[geometry.attributes.alpha.array, 1]}
        />
        <bufferAttribute
          attach="index"
          args={[indices, 1]}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        depthTest={true}
        blending={THREE.AdditiveBlending}
        vertexColors
        vertexShader={`
          attribute float alpha;
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            vColor = color;
            vAlpha = alpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vAlpha;

          void main() {
            // Smooth alpha falloff for professional look
            float alpha = vAlpha * 0.8;
            gl_FragColor = vec4(vColor, alpha);
          }
        `}
      />
    </lineSegments>
  );
}
