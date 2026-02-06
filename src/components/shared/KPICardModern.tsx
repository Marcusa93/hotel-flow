import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface KPICardModernProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    chartData?: { value: number }[];
    className?: string;
    delay?: number;
}

export function KPICardModern({
    title,
    value,
    subtitle,
    icon,
    trend,
    chartData,
    className,
    delay = 0,
}: KPICardModernProps) {
    // Mock data for sparkline if not provided
    const data = chartData || [
        { value: 40 },
        { value: 30 },
        { value: 45 },
        { value: 60 },
        { value: 55 },
        { value: 70 },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
        >
            <Card
                className={cn(
                    "relative overflow-hidden border-none shadow-lg glass group hover:-translate-y-1 transition-transform duration-300",
                    className
                )}
            >
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2.5 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-300">
                            {icon}
                        </div>
                        {trend && (
                            <div
                                className={cn(
                                    "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                                    trend.isPositive
                                        ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
                                        : "text-rose-600 bg-rose-50 dark:bg-rose-950/30"
                                )}
                            >
                                {trend.isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                {trend.value}%
                            </div>
                        )}
                    </div>

                    <div className="space-y-1 z-10 relative">
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
                    </div>

                    {/* Sparkline Chart */}
                    <div className="absolute -bottom-2 -right-2 w-[120px] h-[80px] opacity-30 group-hover:opacity-50 transition-opacity duration-300 pointer-events-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="hsl(var(--primary))"
                                    fillOpacity={1}
                                    fill={`url(#gradient-${title})`}
                                    strokeWidth={2}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
