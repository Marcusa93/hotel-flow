import { ReactNode } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  chartData?: { value: number }[];
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  delay?: number;
  /** Color class for the icon container background */
  iconColor?: string;
  /** Color class for the icon text */
  iconTextColor?: string;
}

const variantStyles = {
  default: '',
  primary: 'border-primary/20 bg-primary/5',
  success: 'border-emerald-500/20 bg-emerald-500/5',
  warning: 'border-accent/20 bg-accent/5',
  danger: 'border-destructive/20 bg-destructive/5',
};

export function KPICard({
  title,
  value,
  subtitle,
  icon,
  trend,
  chartData,
  className,
  variant = 'default',
  delay = 0,
  iconColor,
  iconTextColor,
}: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-accent/40 group',
          variantStyles[variant],
          className
        )}
      >
        <div className="flex justify-between items-start mb-3">
          {icon && (
            <div className={cn(
              'p-2.5 rounded-xl ring-1 ring-primary/10 transition-transform duration-300 group-hover:scale-110',
              iconColor || 'bg-primary/10',
              iconTextColor || 'text-primary'
            )}>
              {icon}
            </div>
          )}
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full',
                trend.isPositive !== false
                  ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'text-rose-600 bg-rose-50 dark:bg-rose-950/30'
              )}
            >
              {trend.isPositive !== false ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              {trend.value}%
            </div>
          )}
        </div>

        <div className="space-y-1 relative z-10">
          <h3 className="text-sm font-medium text-muted-foreground tracking-wide">
            {title}
          </h3>
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {value}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground/80 font-medium">
              {subtitle}
            </p>
          )}
          {trend?.label && (
            <p className="text-xs text-muted-foreground mt-1">
              {trend.label}
            </p>
          )}
        </div>

        {/* Sparkline Chart (optional) */}
        {chartData && chartData.length > 0 && (
          <div className="absolute -bottom-2 -right-2 w-[120px] h-[70px] opacity-20 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`kpi-gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill={`url(#kpi-gradient-${title})`}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </motion.div>
  );
}
