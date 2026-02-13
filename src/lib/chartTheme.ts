/**
 * Centralized Chart Theme System
 *
 * Provides theme-aware colors for all Recharts components.
 * Uses CSS variables so charts automatically adapt to light/dark mode.
 */

// ─── CSS-Variable-Based Colors (auto-adapt to theme) ─────────────────

export const chartColors = {
  primary: 'hsl(var(--chart-1))',
  gold: 'hsl(var(--chart-2))',
  blue: 'hsl(var(--chart-3))',
  emerald: 'hsl(var(--chart-4))',
  rose: 'hsl(var(--chart-5))',

  // Semantic aliases
  revenue: 'hsl(var(--chart-4))',
  occupancy: 'hsl(var(--chart-3))',
  accent: 'hsl(var(--accent))',
  muted: 'hsl(var(--muted-foreground))',
} as const;

// ─── Grid, Axes & Tooltip (theme-aware) ──────────────────────────────

export const chartGrid = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '3 3',
} as const;

export const chartAxis = {
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
  axisLine: { stroke: 'hsl(var(--border))' },
} as const;

export const chartTooltip = {
  contentStyle: {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    color: 'hsl(var(--card-foreground))',
    fontSize: '13px',
  },
  labelStyle: {
    color: 'hsl(var(--foreground))',
    fontWeight: 600,
    marginBottom: '4px',
  },
  cursor: { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 },
} as const;

// ─── Categorical Colors (for pie charts, stacked bars, etc.) ─────────

export const categoricalColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
] as const;

// ─── Status Colors (for room/booking status charts) ──────────────────

export const statusColors = {
  occupied: 'hsl(var(--chart-5))',
  available: 'hsl(var(--chart-4))',
  dirty: 'hsl(var(--chart-2))',
  maintenance: 'hsl(var(--muted-foreground))',
} as const;

// ─── Payment Method Colors ───────────────────────────────────────────

export const paymentMethodColors = {
  CARD: 'hsl(var(--chart-1))',
  CASH: 'hsl(var(--chart-4))',
  TRANSFER: 'hsl(var(--chart-3))',
  OTHER: 'hsl(var(--muted-foreground))',
} as const;

// ─── Gradient Helpers ────────────────────────────────────────────────

export function createGradientDef(
  id: string,
  color: string,
  opacityStart = 0.4,
  opacityEnd = 0
) {
  return { id, color, opacityStart, opacityEnd };
}

// ─── Chart Animation Config ─────────────────────────────────────────

export const chartAnimation = {
  duration: 800,
  easing: 'ease-out' as const,
} as const;
