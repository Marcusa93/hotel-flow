import { useMemo, useState } from 'react';
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
import { Eye, Smartphone, CreditCard, Banknote, MoreHorizontal, CheckCircle2, XCircle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
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
    getBookingInfo: (bookingId: string) => { guest: Guest | undefined; room: Room | undefined; checkIn?: string; checkOut?: string };
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

type SortKey = 'guest' | 'date' | 'method' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

export function TransactionTable({ payments, getBookingInfo, onStatusChange, onViewReceipt }: TransactionTableProps) {
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir(key === 'amount' || key === 'date' ? 'desc' : 'asc');
        }
    };

    const sortedPayments = useMemo(() => {
        const copy = [...payments];
        const dir = sortDir === 'asc' ? 1 : -1;
        copy.sort((a, b) => {
            switch (sortKey) {
                case 'guest': {
                    const nameA = getBookingInfo(a.bookingId).guest?.fullName ?? '';
                    const nameB = getBookingInfo(b.bookingId).guest?.fullName ?? '';
                    return nameA.localeCompare(nameB, 'es') * dir;
                }
                case 'date':
                    return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
                case 'method':
                    return a.method.localeCompare(b.method) * dir;
                case 'amount':
                    return (a.amount - b.amount) * dir;
                case 'status':
                    return a.status.localeCompare(b.status) * dir;
                default:
                    return 0;
            }
        });
        return copy;
    }, [payments, sortKey, sortDir, getBookingInfo]);

    const SortHeader = ({ label, sortBy, align, className }: { label: string; sortBy: SortKey; align?: 'left' | 'right'; className?: string }) => {
        const isActive = sortKey === sortBy;
        const Icon = !isActive ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
        return (
            <TableHead className={className}>
                <button
                    type="button"
                    onClick={() => toggleSort(sortBy)}
                    className={cn(
                        'flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                        'hover:text-slate-900 dark:hover:text-slate-100',
                        isActive ? 'text-slate-900 dark:text-slate-100' : 'text-muted-foreground',
                        align === 'right' && 'ml-auto'
                    )}
                    aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                    {label}
                    <Icon className={cn('w-3 h-3', isActive ? 'opacity-100' : 'opacity-40')} />
                </button>
            </TableHead>
        );
    };

    return (
        <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50">
                        <TableRow className="border-b border-slate-100 dark:border-slate-800 hover:bg-transparent">
                            <SortHeader label="Huésped" sortBy="guest" className="w-[250px]" />
                            <SortHeader label="Fecha" sortBy="date" />
                            <SortHeader label="Método" sortBy="method" />
                            <TableHead>Referencia</TableHead>
                            <SortHeader label="Monto" sortBy="amount" align="right" className="text-right" />
                            <SortHeader label="Estado" sortBy="status" />
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedPayments.map((payment) => {
                            const { guest, room, checkIn, checkOut } = getBookingInfo(payment.bookingId);
                            const stayLabel = checkIn && checkOut
                                ? `${format(new Date(checkIn), 'dd/MM')} → ${format(new Date(checkOut), 'dd/MM')}`
                                : undefined;
                            const daysOverdue = payment.status === 'PENDING' ? differenceInDays(new Date(), new Date(payment.date)) : 0;
                            return (
                                <TableRow key={payment.id} className={cn(
                                    "border-b border-slate-100 dark:border-slate-800 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors",
                                    daysOverdue >= 7 && "bg-red-50/50 dark:bg-red-950/20",
                                    daysOverdue >= 3 && daysOverdue < 7 && "bg-amber-50/50 dark:bg-amber-950/20",
                                )}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-9 h-9 border border-white/50 shadow-sm">
                                                <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-indigo-600 text-xs font-bold">
                                                    {guest?.fullName?.substring(0, 2).toUpperCase() || '??'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{guest?.fullName || 'Desconocido'}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Hab. {room?.roomNumber || '-'}
                                                    {stayLabel && <span className="ml-1.5 text-muted-foreground/70">({stayLabel})</span>}
                                                </p>
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
                                        <div className="flex items-center gap-1.5">
                                            <StatusBadge status={payment.status} />
                                            {payment.status === 'PENDING' && (() => {
                                                const days = differenceInDays(new Date(), new Date(payment.date));
                                                if (days >= 7) return <span className="text-[10px] font-bold text-red-600 dark:text-red-400">{days}d</span>;
                                                if (days >= 3) return <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">{days}d</span>;
                                                return null;
                                            })()}
                                        </div>
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
                {sortedPayments.map((payment) => {
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
