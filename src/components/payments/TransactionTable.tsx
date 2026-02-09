import { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Eye, Smartphone, CreditCard, Banknote, MoreHorizontal, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { Payment, PaymentMethod, PaymentStatus, Guest, Room } from '@/types/hotel';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TransactionTableProps {
    payments: Payment[];
    getBookingInfo: (bookingId: string) => { guest: Guest | undefined; room: Room | undefined };
    onStatusChange?: (paymentId: string, newStatus: PaymentStatus) => void;
    onViewReceipt?: (payment: Payment) => void;
}

const MethodIcon = ({ method }: { method: PaymentMethod }) => {
    switch (method) {
        case 'CARD': return <CreditCard className="w-4 h-4 text-purple-500" />;
        case 'CASH': return <Banknote className="w-4 h-4 text-emerald-500" />;
        case 'TRANSFER': return <Smartphone className="w-4 h-4 text-blue-500" />;
        default: return <CreditCard className="w-4 h-4 text-slate-500" />;
    }
}

export function TransactionTable({ payments, getBookingInfo, onStatusChange, onViewReceipt }: TransactionTableProps) {
    return (
        <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                        <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                            <TableHead className="w-[250px]">Huésped</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Método</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => {
                            const { guest, room } = getBookingInfo(payment.bookingId);
                            return (
                                <TableRow key={payment.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-9 h-9 border border-white/50 shadow-sm">
                                                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 text-xs font-bold">
                                                    {guest?.fullName?.substring(0, 2).toUpperCase() || '??'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{guest?.fullName || 'Desconocido'}</p>
                                                <p className="text-[11px] text-muted-foreground">Hab. {room?.roomNumber || '-'}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground font-medium">
                                        {format(new Date(payment.date), 'dd MMM yyyy', { locale: es })}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                                <MethodIcon method={payment.method} />
                                            </div>
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:inline-block">
                                                {payment.method === 'CARD' ? 'Tarjeta' : payment.method === 'CASH' ? 'Efectivo' : 'Transf.'}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {payment.reference || '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-slate-800 dark:text-slate-200">
                                        ${payment.amount.toLocaleString('es-AR')}
                                    </TableCell>
                                    <TableCell>
                                        <StatusBadge status={payment.status} />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-[180px]">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                {payment.status === 'PENDING' && onStatusChange && (
                                                    <DropdownMenuItem onClick={() => onStatusChange(payment.id, 'PAID')}>
                                                        <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-500" />
                                                        Marcar Pagado
                                                    </DropdownMenuItem>
                                                )}
                                                {payment.status === 'PAID' && onStatusChange && (
                                                    <DropdownMenuItem onClick={() => onStatusChange(payment.id, 'REFUNDED')}>
                                                        <XCircle className="w-4 h-4 mr-2 text-rose-500" />
                                                        Reembolsar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onViewReceipt?.(payment)}>
                                                    <Eye className="w-4 h-4 mr-2" />
                                                    Ver Recibo
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onViewReceipt?.(payment)}>
                                                    Descargar PDF
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {payments.map((payment) => {
                    const { guest, room } = getBookingInfo(payment.bookingId);
                    return (
                        <div key={payment.id} className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-white/20 p-4 rounded-xl shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10 border border-white/50 shadow-sm">
                                        <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 text-xs font-bold">
                                            {guest?.fullName?.substring(0, 2).toUpperCase() || '??'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{guest?.fullName || 'Desconocido'}</p>
                                        <p className="text-xs text-muted-foreground">Habitación {room?.roomNumber || '-'}</p>
                                    </div>
                                </div>
                                <StatusBadge status={payment.status} />
                            </div>

                            <div className="flex items-center justify-between py-2 border-t border-b border-slate-100 dark:border-slate-800/50">
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Fecha</span>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                        {format(new Date(payment.date), 'dd MMM yyyy', { locale: es })}
                                    </span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Monto</span>
                                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                        ${payment.amount.toLocaleString('es-AR')}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                    <div className="p-1 rounded-full bg-slate-100 dark:bg-slate-800">
                                        <MethodIcon method={payment.method} />
                                    </div>
                                    <span>{payment.method === 'CARD' ? 'Tarjeta' : payment.method === 'CASH' ? 'Efectivo' : 'Transf.'}</span>
                                </div>
                                {payment.reference && (
                                    <span className="font-mono text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                        {payment.reference}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
