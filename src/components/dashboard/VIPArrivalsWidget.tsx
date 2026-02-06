import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Crown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Viper {
    id: string;
    name: string;
    level: string;
    email: string;
}

const mockVips: Viper[] = [
    { id: '1', name: 'Laura Miller', level: 'Platinum', email: 'laura.m@example.com' },
    { id: '2', name: 'Roberto Baggio', level: 'Gold', email: 'rob.baggio@example.com' },
];

export function VIPArrivalsWidget() {
    return (
        <Card className="col-span-1 lg:col-span-3 border-none shadow-lg bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -mr-16 -mt-32 pointer-events-none" />

            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Crown className="w-4 h-4 text-amber-400" fill="currentColor" />
                        Llegadas VIP (Hoy)
                    </CardTitle>
                    <Link to="/guests">
                        <Button size="sm" variant="ghost" className="h-8 text-slate-300 hover:text-white hover:bg-white/10">
                            Ver todos <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                    </Link>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {mockVips.map(vip => (
                    <div key={vip.id} className="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                        <div className="relative">
                            <Avatar className="h-10 w-10 border border-amber-500/50">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${vip.email}`} />
                                <AvatarFallback className="bg-slate-700 text-white text-xs">{vip.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-[8px] font-bold text-black px-1 rounded-sm uppercase">
                                VIP
                            </div>
                        </div>

                        <div className="flex-1">
                            <p className="font-bold text-sm">{vip.name}</p>
                            <p className="text-xs text-slate-400">{vip.level} Member • Check-in Pendiente</p>
                        </div>

                        <Button size="sm" className="h-7 text-xs bg-amber-500 text-slate-900 hover:bg-amber-400 border-none">
                            Asignar
                        </Button>
                    </div>
                ))}

                {mockVips.length === 0 && (
                    <p className="text-sm text-slate-400 italic text-center py-4">No hay llegadas VIP hoy.</p>
                )}
            </CardContent>
        </Card>
    );
}
