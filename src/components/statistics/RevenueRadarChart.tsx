import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

export function RevenueRadarChart() {
    // Mock data for sources breakdown
    const data = [
        { subject: 'Habitaciones', A: 120, fullMark: 150 },
        { subject: 'Mini-Bar', A: 98, fullMark: 150 },
        { subject: 'Restaurante', A: 86, fullMark: 150 },
        { subject: 'Eventos', A: 99, fullMark: 150 },
        { subject: 'Spa', A: 85, fullMark: 150 },
        { subject: 'Tours', A: 65, fullMark: 150 },
    ];

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-medium text-slate-800 dark:text-slate-200">
                    Fuentes de Ingresos (Radar)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                            <PolarGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                            <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fontSize: 11, fill: '#64748b' }}
                            />
                            <PolarRadiusAxis angle={30} domain={[0, 150]} hide />
                            <Radar
                                name="Revenue"
                                dataKey="A"
                                stroke="#8b5cf6"
                                strokeWidth={2}
                                fill="#8b5cf6"
                                fillOpacity={0.3}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    backdropFilter: 'blur(8px)',
                                    border: '1px solid rgba(255,255,255,0.5)',
                                    borderRadius: '12px',
                                    color: '#0f172a'
                                }}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
