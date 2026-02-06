import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  className?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}

const variantStyles = {
  default: '',
  primary: 'border-primary/20 bg-primary/5',
  success: 'border-status-available/20 bg-status-available/5',
  warning: 'border-accent/20 bg-accent/5',
  danger: 'border-destructive/20 bg-destructive/5',
};

export function KPICard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  className,
  variant = 'default' 
}: KPICardProps) {
  return (
    <div className={cn('kpi-card', variantStyles[variant], className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="kpi-label">{title}</p>
          <p className="kpi-value">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-muted">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className={cn(
          'mt-3 pt-3 border-t',
          trend.isPositive ? 'kpi-trend-up' : 'kpi-trend-down'
        )}>
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{trend.value}%</span>
          <span className="text-muted-foreground ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
