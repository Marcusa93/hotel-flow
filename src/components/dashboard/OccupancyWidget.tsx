import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { statusColors, chartTooltip } from '@/lib/chartTheme';

interface OccupancyWidgetProps {
    stats: {
        clean: number;
        dirty: number;
        occupied: number;
        maintenance: number;
    };
}

export function OccupancyWidget({ stats }: OccupancyWidgetProps) {
    const data = [
        { name: 'Ocupadas', value: stats.occupied, color: statusColors.occupied },
        { name: 'Disponibles', value: stats.clean, color: statusColors.available },
        { name: 'Sucias', value: stats.dirty, color: statusColors.dirty },
        { name: 'Mant.', value: stats.maintenance, color: statusColors.maintenance },
    ].filter(d => d.value > 0);

    return (
        <Card className="col-span-1 lg:col-span-3 h-[400px] border-none shadow-lg bg-white/50 dark:bg-slate-900/50 backdrop-blur flex flex-col">
            <CardHeader>
                <CardTitle className="text-lg">Estado de Habitaciones</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center relative">
                <div className="w-full h-full max-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                cornerRadius={5}
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={chartTooltip.contentStyle} />
                        </PieChart>
                    </ResponsiveContainer>

                    {/* Center Label */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -mt-4 text-center pointer-events-none">
                        <p className="text-3xl font-bold">{stats.occupied + stats.clean + stats.dirty + stats.maintenance}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-6 w-full px-8">
                    {data.map(item => (
                        <div key={item.name} className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground">{item.name}</span>
                            </div>
                            <span className="font-bold">{item.value}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
