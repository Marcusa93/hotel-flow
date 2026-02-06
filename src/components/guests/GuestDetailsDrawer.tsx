
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Guest } from '@/types/hotel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Phone, MapPin, Calendar, CreditCard, X, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface GuestDetailsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    guest?: Guest;
}

export function GuestDetailsDrawer({ isOpen, onClose, guest }: GuestDetailsDrawerProps) {
    if (!guest) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-full sm:max-w-xl p-0 bg-white/95 backdrop-blur-xl border-l border-white/20 shadow-2xl">
                <div className="relative h-48 bg-slate-900 text-white p-8 flex flex-col justify-end overflow-hidden">
                    {/* Abstract BG */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/30 rounded-full blur-3xl -mr-16 -mt-32 pointer-events-none"></div>

                    <div className="relative z-10 flex items-end gap-6">
                        <Avatar className="h-24 w-24 border-4 border-white/20 shadow-xl">
                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${guest.email}`} />
                            <AvatarFallback className="bg-slate-800 text-white font-bold text-2xl">
                                {guest.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="mb-2">
                            <h2 className="text-3xl font-bold tracking-tight">{guest.fullName}</h2>
                            <p className="text-slate-300 font-mono text-sm opacity-80">{guest.email}</p>
                        </div>
                    </div>

                    <div className="absolute top-4 right-4">
                        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/10 hover:bg-white/20 text-white">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <ScrollArea className="h-[calc(100vh-192px)] p-8">
                    <div className="grid gap-8">
                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Información Personal</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <p className="text-xs text-muted-foreground mb-1">Documento</p>
                                    <p className="font-medium">{guest.documentId || 'No registrado'}</p>
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <p className="text-xs text-muted-foreground mb-1">Teléfono</p>
                                    <p className="font-medium">{guest.phone}</p>
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <p className="text-xs text-muted-foreground mb-1">Nacionalidad</p>
                                    <p className="font-medium">{guest.country || 'No registrada'}</p>
                                </div>
                                <div className="p-4 rounded-xl border bg-slate-50/50">
                                    <p className="text-xs text-muted-foreground mb-1">Cliente Desde</p>
                                    <p className="font-medium">{format(new Date(guest.createdAt), 'MMM yyyy')}</p>
                                </div>
                            </div>
                        </section>

                        <Separator />

                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notas y Preferencias</h3>
                                <Button variant="ghost" size="sm" className="h-8 text-primary">
                                    <Edit className="w-3 h-3 mr-2" /> Editar
                                </Button>
                            </div>
                            <div className="p-4 rounded-xl border border-yellow-200 bg-yellow-50 text-yellow-900 text-sm leading-relaxed">
                                {guest.notes || "Sin notas adicionales para este huésped."}
                            </div>
                        </section>

                        <Separator />

                        <section>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Acciones</h3>
                            <div className="flex gap-4">
                                <Button className="w-full" variant="outline">
                                    <Mail className="w-4 h-4 mr-2" /> Enviar Email
                                </Button>
                                <Button className="w-full text-rose-600 hover:text-rose-700 border-rose-200 bg-rose-50 hover:bg-rose-100" variant="outline">
                                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                </Button>
                            </div>
                        </section>
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
