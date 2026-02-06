import { useState } from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StubIndicator } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SeasonalityChart, RateCalendarWidget } from '@/components/rates';
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
  const { rates, roomTypes, deleteRate } = useHotel();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const getRoomTypeName = (roomTypeId: string) =>
    roomTypes.find(rt => rt.id === roomTypeId)?.name || '';

  const handleDelete = (id: string) => {
    deleteRate(id);
    toast({
      title: 'Tarifa eliminada',
      description: 'La tarifa ha sido eliminada del sistema',
    });
  };

  const promotions = rates.filter(r => !r.label.includes('Base'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarifas Dinámicas"
        description="Gestión inteligente de precios y demanda"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-500/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Nueva Regla
            </Button>
          </div>
        }
      />

      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-5 duration-500">
        <div className="lg:col-span-2">
          <SeasonalityChart rates={rates} />
        </div>
        <div>
          <RateCalendarWidget />
        </div>
      </div>

      {/* Base rates Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">Tarifas Base</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {roomTypes.map(type => (
            <div key={type.id} className="p-4 rounded-2xl border border-white/20 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md hover:scale-[1.02] transition-transform duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-800 dark:text-slate-200">{type.name}</span>
                <Badge variant="outline" className="border-purple-200 text-purple-600 bg-purple-50 dark:bg-purple-900/20">Base</Badge>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-white">
                ${type.basePrice.toLocaleString('es-AR')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                por noche • máx. {type.maxGuests} huéspedes
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Active Promotions Table */}
      <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20">
        <CardHeader>
          <CardTitle className="text-lg">Reglas y Promociones Activas</CardTitle>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay promociones activas
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableHead>Nombre de la Regla</TableHead>
                  <TableHead>Aplicado a</TableHead>
                  <TableHead>Precio Modificado</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map(rate => (
                  <TableRow key={rate.id} className="border-slate-200 dark:border-slate-800 hover:bg-white/30 dark:hover:bg-slate-800/30">
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        {rate.label}
                      </div>
                    </TableCell>
                    <TableCell>{getRoomTypeName(rate.roomTypeId)}</TableCell>
                    <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                      ${rate.price.toLocaleString('es-AR')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(rate.startDate), 'dd MMM')} - {format(new Date(rate.endDate), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={rate.isActive ? 'default' : 'secondary'} className={rate.isActive ? "bg-emerald-500 hover:bg-emerald-600" : ""}>
                        {rate.isActive ? 'Activa' : 'Pausada'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon">
                          <Edit className="w-4 h-4 text-slate-500" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rate.id)}
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
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

      {/* Dialog remains same basic mock for now */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Regla de Precio</DialogTitle>
            <DialogDescription>
              Configura una variación de tarifa temporal
            </DialogDescription>
          </DialogHeader>
          {/* Form simplified for visual demo */}
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input placeholder="Ej: Oferta Fin de Semana" />
            </div>
            {/* ... other fields ... */}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              toast({ title: 'Regla creada' });
              setIsDialogOpen(false);
            }}>Guardar Regla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
