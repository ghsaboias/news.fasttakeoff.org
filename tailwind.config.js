/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
          hover: "var(--secondary-hover)",
        },
        "soft-border": {
          DEFAULT: "var(--soft-border)",
          foreground: "var(--soft-border-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
          hover: "var(--destructive-hover)",
          light: "var(--destructive-light)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
          hover: "var(--accent-hover)",
        },
        black: {
          transparent: "var(--black-transparent)",
        },
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
          light: "var(--muted-light)",
          lighter: "var(--muted-lighter)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: {
          DEFAULT: "var(--ring)",
          hover: "var(--ring-hover)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        // Industrial theme colors
        industrial: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#f59e0b', // Primary amber
          600: '#ea580c', // Primary orange
          700: '#dc2626', // Primary red
          800: '#b91c1c',
          900: '#991b1b',
        },
        // Dark industrial grays
        dark: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0a0a0a', // Deep black
        },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      spacing: {
        content: "90%",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      // Industrial theme gradients
      backgroundImage: {
        'industrial-gradient': 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #ea580c 100%)',
        'dark-gradient': 'linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #1f2937 100%)',
        'card-gradient': 'linear-gradient(135deg, #111111 0%, #1f2937 100%)',
        'metallic': 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, transparent 50%)',
      },
      // Industrial shadows
      boxShadow: {
        'industrial': '0 10px 25px -3px rgba(245, 158, 11, 0.1), 0 4px 6px -2px rgba(245, 158, 11, 0.05)',
        'industrial-lg': '0 20px 25px -5px rgba(245, 158, 11, 0.1), 0 10px 10px -5px rgba(245, 158, 11, 0.04)',
        'dark': '0 10px 25px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
