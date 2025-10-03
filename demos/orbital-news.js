// Orbital News Visualization
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Config
const config = {
    G: 0.5, // Gravitational constant
    damping: 0.999, // Velocity damping
    centerX: 0,
    centerY: 0,
    scale: 1,
    minOrbitRadius: 60,
    maxOrbitRadius: 250,
    isPaused: false
};

// Resize canvas
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    config.centerX = canvas.width / 2;
    config.centerY = canvas.height / 2;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Bodies in the system
const bodies = [];
const systems = new Map(); // Entity name -> System it belongs to

// Stop words to filter
const STOP_WORDS = new Set([
    'September', 'October', 'November', 'December', 'January', 'February',
    'This', 'That', 'These', 'Those', 'The', 'One', 'Two', 'Three',
    'Multiple', 'Several', 'Many', 'Throughout', 'During'
]);

class CelestialBody {
    constructor(name, type = 'planet') {
        this.name = name;
        this.type = type; // 'star', 'planet', 'moon'
        this.x = config.centerX + (Math.random() - 0.5) * 400;
        this.y = config.centerY + (Math.random() - 0.5) * 400;
        this.vx = 0;
        this.vy = 0;

        // Physics
        this.mass = 1;
        this.radius = 5;

        // Visuals
        this.color = '#fff';
        this.glow = 0;
        this.trail = [];
        this.maxTrailLength = 20;

        // Data
        this.mentions = 1;
        this.lastMention = Date.now();
        this.heat = 1.0; // Activity level
        this.orbitTarget = null;
        this.satellites = [];
    }

    setAsStart(totalMentions) {
        this.type = 'star';
        this.mass = 10 + totalMentions * 2;
        this.radius = 20 + Math.log(totalMentions) * 5;
        this.color = this.getStarColor();
        this.x = config.centerX;
        this.y = config.centerY;
    }

    setAsPlanet(parentStar, distance) {
        this.type = 'planet';
        this.mass = 2 + this.mentions;
        this.radius = 8 + Math.log(this.mentions + 1) * 3;
        this.orbitTarget = parentStar;

        // Set initial orbital position
        const angle = Math.random() * Math.PI * 2;
        this.x = parentStar.x + Math.cos(angle) * distance;
        this.y = parentStar.y + Math.sin(angle) * distance;

        // Set orbital velocity (perpendicular to radius)
        const speed = Math.sqrt(config.G * parentStar.mass / distance) * 0.5;
        this.vx = -Math.sin(angle) * speed;
        this.vy = Math.cos(angle) * speed;
    }

    getStarColor() {
        // Heat-based color for stars
        if (this.heat > 0.8) return '#ffddaa'; // Hot white
        if (this.heat > 0.6) return '#ffaa00'; // Orange
        if (this.heat > 0.4) return '#ff6600'; // Red-orange
        return '#ff0000'; // Cool red
    }

    getPlanetColor() {
        // Type-based colors for planets
        const colors = {
            'Ukraine': '#ffaa00',
            'Russia': '#ff4444',
            'Trump': '#8844ff',
            'Israel': '#00ff88',
            'Moldova': '#ff88cc',
            'Portland': '#00aaff',
            'Federal': '#888888',
            'Kyiv': '#ffcc00'
        };
        return colors[this.name] || '#aaaaaa';
    }

    addMention() {
        this.mentions++;
        this.heat = Math.min(1.0, this.heat + 0.3);
        this.lastMention = Date.now();
        this.glow = 1.0;

        // Grow with mentions
        if (this.type === 'star') {
            this.mass += 2;
            this.radius += 0.5;
        } else {
            this.mass += 0.5;
            this.radius += 0.2;
        }
    }

    update(bodies, dt) {
        if (config.isPaused) return;

        // Cool down over time
        this.heat *= 0.998;
        this.glow *= 0.95;

        // Update trail
        if (this.type !== 'star') {
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > this.maxTrailLength) {
                this.trail.shift();
            }
        }

        // Apply gravity from all bodies
        bodies.forEach(other => {
            if (other === this) return;

            const dx = other.x - this.x;
            const dy = other.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < this.radius + other.radius) return; // Collision avoidance

            // Gravitational force
            const force = config.G * this.mass * other.mass / (dist * dist);
            const ax = force * dx / dist / this.mass;
            const ay = force * dy / dist / this.mass;

            this.vx += ax * dt;
            this.vy += ay * dt;
        });

        // Apply velocity damping
        this.vx *= config.damping;
        this.vy *= config.damping;

        // Update position
        if (this.type !== 'star') {
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }
    }

    render() {
        // Draw trail
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.type === 'star' ? this.getStarColor() : this.getPlanetColor();
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            this.trail.forEach((point, i) => {
                if (i === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw glow for active bodies
        if (this.glow > 0.1 || this.type === 'star') {
            const glowSize = this.radius * (2 + this.glow);
            const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, glowSize);
            gradient.addColorStop(0, this.type === 'star' ? this.getStarColor() : this.getPlanetColor());
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.3 + this.glow * 0.3;
            ctx.beginPath();
            ctx.arc(this.x, this.y, glowSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        // Draw body
        ctx.fillStyle = this.type === 'star' ? this.getStarColor() : this.getPlanetColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw rings for stars
        if (this.type === 'star') {
            ctx.strokeStyle = this.getStarColor();
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius + 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // Draw label
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.min(14, 10 + this.radius / 5)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.radius - 8);

        // Draw mention count
        if (this.mentions > 1) {
            ctx.fillStyle = '#00ff88';
            ctx.font = '10px Arial';
            ctx.fillText(`×${this.mentions}`, this.x, this.y + this.radius + 15);
        }
    }
}

// Process event data into orbital systems
function createOrbitalSystems() {
    if (!window.EVENT_DATA) return;

    // Count mentions
    const entityCounts = {};
    EVENT_DATA.forEach(event => {
        if (!STOP_WORDS.has(event.name)) {
            entityCounts[event.name] = (entityCounts[event.name] || 0) + 1;
        }
    });

    // Find top entities to be stars (>= 5 mentions)
    const stars = [];
    Object.entries(entityCounts)
        .filter(([name, count]) => count >= 5)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3) // Max 3 star systems
        .forEach(([name, count]) => {
            const star = new CelestialBody(name);
            star.setAsStart(count);
            bodies.push(star);
            stars.push(star);
            systems.set(name, star);
        });

    // Create planets around stars (2-4 mentions)
    Object.entries(entityCounts)
        .filter(([name, count]) => count >= 2 && count < 5)
        .forEach(([name, count]) => {
            const planet = new CelestialBody(name);
            planet.mentions = count;

            // Assign to nearest star
            if (stars.length > 0) {
                const parentStar = stars[Math.floor(Math.random() * stars.length)];
                const distance = config.minOrbitRadius + Math.random() * (config.maxOrbitRadius - config.minOrbitRadius);
                planet.setAsPlanet(parentStar, distance);
                parentStar.satellites.push(planet);
                systems.set(name, parentStar);
            }

            bodies.push(planet);
        });

    updateStats();
}

function updateStats() {
    document.getElementById('body-count').textContent = bodies.length;
    document.getElementById('system-count').textContent = new Set(systems.values()).size;
    document.getElementById('sim-time').textContent = new Date().toLocaleTimeString();
}

// Animation loop
let lastTime = Date.now();
function animate() {
    const now = Date.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to avoid instability
    lastTime = now;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and render bodies
    bodies.forEach(body => body.update(bodies, dt));
    bodies.forEach(body => body.render());

    updateStats();
    requestAnimationFrame(animate);
}

// Controls
document.getElementById('pause-btn').addEventListener('click', () => {
    config.isPaused = !config.isPaused;
    document.getElementById('pause-btn').textContent = config.isPaused ? '▶️ Play' : '⏸️ Pause';
});

document.getElementById('reset-btn').addEventListener('click', () => {
    bodies.length = 0;
    systems.clear();
    createOrbitalSystems();
});

document.getElementById('zoom-in-btn').addEventListener('click', () => {
    config.scale *= 1.2;
    bodies.forEach(body => {
        body.x = config.centerX + (body.x - config.centerX) * 1.2;
        body.y = config.centerY + (body.y - config.centerY) * 1.2;
    });
});

document.getElementById('zoom-out-btn').addEventListener('click', () => {
    config.scale /= 1.2;
    bodies.forEach(body => {
        body.x = config.centerX + (body.x - config.centerX) / 1.2;
        body.y = config.centerY + (body.y - config.centerY) / 1.2;
    });
});

// Initialize
createOrbitalSystems();
animate();