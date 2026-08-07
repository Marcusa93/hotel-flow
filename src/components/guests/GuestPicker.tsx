import { useMemo, useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useGuestOperations } from '@/hooks/domain/useGuestOperations';
import { toast } from '@/hooks/use-toast';

interface GuestPickerProps {
    value: string;
    onChange: (guestId: string) => void;
    label?: string;
    hint?: string;
    /** Texto del campo de nombre al dar de alta. Un grupo no se llama igual que una persona. */
    newNamePlaceholder?: string;
}

/**
 * Elegir un cliente, con alta rápida si no está.
 *
 * Sin esto había que cortar lo que se estaba cargando, ir a Huéspedes, crear el
 * cliente y volver a empezar la reserva — y en la masiva eso significa perder
 * las fechas y las habitaciones ya elegidas.
 *
 * El alta de acá pide lo mínimo: el nombre. Un contingente se carga como un
 * cliente más ("Grupo San Martín") y sus datos reales, si hacen falta, se
 * completan después desde Huéspedes. Pedir documento y teléfono acá sería poner
 * el formulario completo en el medio de otro formulario, que es justamente lo
 * que esto viene a evitar.
 */
export function GuestPicker({
    value,
    onChange,
    label = 'A nombre de',
    hint,
    newNamePlaceholder = 'Nombre del cliente',
}: GuestPickerProps) {
    const { guests, addGuest } = useGuestOperations();
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Si ya hay uno con ese nombre. Sin este aviso, "Grupo San Martín" cargado
     * dos veces son dos clientes distintos, y la mitad de las reservas del grupo
     * quedan colgando del que nadie mira.
     */
    const yaExiste = useMemo(() => {
        const limpio = name.trim().toLowerCase();
        if (!limpio) return undefined;
        return guests.find(g => g.fullName.trim().toLowerCase() === limpio);
    }, [guests, name]);

    const crear = async () => {
        const limpio = name.trim();
        if (limpio.length < 2) return;
        setIsSubmitting(true);
        try {
            const guest = await addGuest({
                fullName: limpio,
                // Vacíos y no inventados: el sistema los trata como "falta el
                // dato", que es la verdad. Un teléfono de relleno se propaga a
                // la ficha y a los avisos.
                phone: phone.trim(),
                email: '',
            });
            onChange(guest.id);
            setCreating(false);
            setName('');
            setPhone('');
            toast({ title: 'Cliente creado', description: limpio });
        } catch (error) {
            toast({
                title: 'No se pudo crear',
                description: error instanceof Error ? error.message : 'Intentá de nuevo.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (creating) {
        return (
            <div className="space-y-2 rounded-xl border border-dashed p-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="gp-name">Cliente nuevo</Label>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => { setCreating(false); setName(''); setPhone(''); }}
                    >
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                    </Button>
                </div>
                <Input
                    id="gp-name"
                    autoFocus
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={newNamePlaceholder}
                    onKeyDown={e => e.key === 'Enter' && !yaExiste && crear()}
                />
                <Input
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Teléfono de contacto (opcional)"
                    inputMode="tel"
                />

                {yaExiste ? (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
                        <span>Ya existe <strong>{yaExiste.fullName}</strong>.</span>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                                onChange(yaExiste.id);
                                setCreating(false);
                                setName('');
                                setPhone('');
                            }}
                        >
                            Usar ese
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="sm"
                        onClick={crear}
                        disabled={name.trim().length < 2 || isSubmitting}
                        className="w-full"
                    >
                        {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Crear y elegir
                    </Button>
                )}
                <p className="text-[11px] text-muted-foreground">
                    Con el nombre alcanza. El resto de los datos se completan después desde Huéspedes.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <Label htmlFor="gp-select">{label}</Label>
            <div className="flex gap-2">
                <select
                    id="gp-select"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                    <option value="">Elegí el cliente…</option>
                    {guests.map(g => (
                        <option key={g.id} value={g.id}>{g.fullName}</option>
                    ))}
                </select>
                <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setCreating(true)}
                    title="Crear un cliente nuevo sin salir de acá"
                >
                    <Plus className="w-4 h-4 mr-1" /> Nuevo
                </Button>
            </div>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}
