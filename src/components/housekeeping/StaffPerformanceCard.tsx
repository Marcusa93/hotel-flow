import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface StaffPerformanceCardProps {
    name: string;
    completed: number;
    total: number;
}

export function StaffPerformanceCard({ name, completed, total }: StaffPerformanceCardProps) {
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm border-white/20 shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-10 w-10 border border-white/50">
                    <AvatarFallback className="bg-indigo-100 text-indigo-600 font-bold">
                        {name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex justify-between mb-1">
                        <span className="font-medium text-sm text-slate-700 dark:text-slate-200">{name}</span>
                        <span className="text-xs text-muted-foreground">{completed}/{total} Habitaciones</span>
                    </div>
                    <Progress value={percentage} className="h-2 bg-indigo-100 dark:bg-indigo-900/20" indicatorClassName="bg-indigo-500" />
                </div>
            </CardContent>
        </Card>
    );
}
