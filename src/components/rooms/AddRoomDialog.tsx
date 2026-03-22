import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, BedDouble } from 'lucide-react';
import { useCreateRoom } from '@/hooks/useCreateRoom';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { toast } from '@/hooks/use-toast';

interface AddRoomDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AddRoomDialog({ open, onOpenChange }: AddRoomDialogProps) {
    const { roomTypes } = useRoomOperations();
    const createRoom = useCreateRoom();

    const [roomNumber, setRoomNumber] = useState('');
    const [roomTypeId, setRoomTypeId] = useState('');
    const [floor, setFloor] = useState('');
    const [notes, setNotes] = useState('');

    const resetForm = () => {
        setRoomNumber('');
        setRoomTypeId('');
        setFloor('');
        setNotes('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!roomNumber.trim() || !roomTypeId || !floor) {
            toast({
                title: 'Campos requeridos',
                description: 'Completá número, tipo y piso de la habitación.',
                variant: 'destructive',
            });
            return;
        }

        try {
            await createRoom.mutateAsync({
                roomNumber: roomNumber.trim(),
                roomTypeId,
                floor: parseInt(floor, 10),
                notes: notes.trim() || undefined,
            });

            toast({
                title: '✅ Habitación creada',
                description: `Habitación ${roomNumber} agregada exitosamente.`,
            });

            resetForm();
            onOpenChange(false);
        } catch (error: unknown) {
            toast({
                title: 'Error al crear habitación',
                description: error instanceof Error ? error.message : 'No se pudo crear la habitación. Verificá que el número no esté duplicado.',
                variant: 'destructive',
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <BedDouble className="w-5 h-5 text-primary" />
                        Nueva Habitación
                    </DialogTitle>
                    <DialogDescription>
                        Agregá una nueva habitación al inventario del hotel.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="roomNumber">Número *</Label>
                            <Input
                                id="roomNumber"
                                placeholder="Ej: 101"
                                value={roomNumber}
                                onChange={(e) => setRoomNumber(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="floor">Piso *</Label>
                            <Input
                                id="floor"
                                type="number"
                                min={0}
                                max={50}
                                placeholder="Ej: 1"
                                value={floor}
                                onChange={(e) => setFloor(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="roomType">Tipo de habitación *</Label>
                        <Select value={roomTypeId} onValueChange={setRoomTypeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleccionar tipo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {roomTypes.map((type) => (
                                    <SelectItem key={type.id} value={type.id}>
                                        {type.name} — ${type.basePrice?.toLocaleString('es-AR') || 0}/noche
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Notas (opcional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Ej: Vista al mar, balcón privado..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[80px]"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={createRoom.isPending}>
                            {createRoom.isPending ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Creando...
                                </>
                            ) : (
                                <>
                                    <BedDouble className="w-4 h-4 mr-2" />
                                    Crear Habitación
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
