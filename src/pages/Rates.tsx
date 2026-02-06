import { useState } from 'react';
import { Plus, Edit, Trash2, Calendar } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StubIndicator } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

export default function Rates() {
  const { rates, roomTypes, addRate, updateRate, deleteRate } = useHotel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<string | null>(null);

  const getRoomTypeName = (roomTypeId: string) => 
    roomTypes.find(rt => rt.id === roomTypeId)?.name || '';

  const handleDelete = (id: string) => {
    deleteRate(id);
    toast({
      title: 'Tarifa eliminada',
      description: 'La tarifa ha sido eliminada del sistema',
    });
  };

  const activeRates = rates.filter(r => r.isActive);
  const baseRates = rates.filter(r => r.label.includes('Base'));
  const promotions = rates.filter(r => !r.label.includes('Base'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarifas y Promociones"
        description="Gestión de precios y ofertas especiales"
        actions={
          <div className="flex items-center gap-2">
            <StubIndicator message="CRUD simulado en memoria" />
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarifa
            </Button>
          </div>
        }
      />

      {/* Base rates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tarifas Base por Tipo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {roomTypes.map(type => (
              <div key={type.id} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{type.name}</span>
                  <Badge variant="outline">Base</Badge>
                </div>
                <div className="text-2xl font-bold text-primary">
                  ${type.basePrice.toLocaleString('es-AR')}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  por noche • máx. {type.maxGuests} huéspedes
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Promotions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Promociones y Tarifas Especiales</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay promociones activas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo Habitación</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Fecha Fin</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map(rate => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.label}</TableCell>
                    <TableCell>{getRoomTypeName(rate.roomTypeId)}</TableCell>
                    <TableCell className="font-medium">
                      ${rate.price.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell>
                      {format(new Date(rate.startDate), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(rate.endDate), 'dd MMM yyyy', { locale: es })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                        {rate.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(rate.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New rate dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tarifa</DialogTitle>
            <DialogDescription>
              Crea una nueva tarifa o promoción temporal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de la tarifa</Label>
              <Input placeholder="Ej: Promo Verano 2024" />
            </div>
            <div>
              <Label>Tipo de habitación</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Precio por noche ($)</Label>
              <Input type="number" placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha inicio</Label>
                <Input type="date" />
              </div>
              <div>
                <Label>Fecha fin</Label>
                <Input type="date" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              toast({ title: 'Tarifa creada (simulado)' });
              setIsDialogOpen(false);
            }}>
              Crear Tarifa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
