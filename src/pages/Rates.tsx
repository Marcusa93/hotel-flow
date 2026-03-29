import { useState, useMemo, lazy, Suspense } from 'react';
import { Plus, Edit, Trash2, Tag, Percent, Calendar, Check, X, Copy, Zap } from 'lucide-react';
import { useRoomOperations } from '@/hooks/domain/useRoomOperations';
import { PageHeader } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StatisticsContent = lazy(() => import('./Statistics'));
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SeasonalityChart, RateCalendarWidget } from '@/components/rates';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format, isBefore, isAfter, isWithinInterval } from 'date-fns';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useRates } from '@/hooks/useRates';
import { useCreateRate } from '@/hooks/useCreateRate';
import { useUpdateRate } from '@/hooks/useUpdateRate';
import { useDeleteRate } from '@/hooks/useDeleteRate';
import { Rate, DiscountType } from '@/types/hotel';
import { PAYMENT_METHOD_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useUpdateRoomType } from '@/hooks/useUpdateRoomType';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function Rates() {
  const { roomTypes } = useRoomOperations();
  const updateRoomTypeMutation = useUpdateRoomType();
  const { data: rates = [], isLoading } = useRates();
  const createRateMutation = useCreateRate();
  const updateRateMutation = useUpdateRate();
  const deleteRateMutation = useDeleteRate();

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<Rate | null>(null);
  const [editingBasePrice, setEditingBasePrice] = useState<{ id: string; price: number } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    label: '',
    roomTypeId: '',
    price: 0,
    startDate: '',
    endDate: '',
    discountType: 'PERCENTAGE' as DiscountType,
    discountPercent: 0,
    discountAmount: 0,
    minNights: 1,
    promoCode: '',
    isActive: true,
    paymentMethods: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      label: '',
      roomTypeId: '',
      price: 0,
      startDate: '',
      endDate: '',
      discountType: 'PERCENTAGE' as DiscountType,
      discountPercent: 0,
      discountAmount: 0,
      minNights: 1,
      promoCode: '',
      isActive: true,
      paymentMethods: [],
    });
  };

  const getRoomTypeName = (roomTypeId: string) =>
    roomTypes.find(rt => rt.id === roomTypeId)?.name || '';

  const promotions = useMemo(() =>
    rates.filter(r => !r.label.toLowerCase().includes('base')),
    [rates]
  );

  // Check if a promotion is currently active (within date range)
  const isCurrentlyActive = (rate: Rate) => {
    const now = new Date();
    return rate.isActive && isWithinInterval(now, {
      start: new Date(rate.startDate),
      end: new Date(rate.endDate)
    });
  };

  // Handle create/edit rate
  const handleSave = async () => {
    try {
      if (editingRate) {
        await updateRateMutation.mutateAsync({
          id: editingRate.id,
          data: {
            label: formData.label,
            roomTypeId: formData.roomTypeId,
            price: formData.price,
            startDate: new Date(formData.startDate),
            endDate: new Date(formData.endDate),
            discountType: formData.discountType,
            discountPercent: formData.discountType === 'PERCENTAGE' ? formData.discountPercent : undefined,
            discountAmount: formData.discountType === 'FIXED' ? formData.discountAmount : undefined,
            minNights: formData.minNights,
            promoCode: formData.promoCode,
            isActive: formData.isActive,
            paymentMethods: formData.paymentMethods.length ? formData.paymentMethods : undefined,
          },
        });
        toast({
          title: '✅ Tarifa actualizada',
          description: 'Los cambios se guardaron correctamente',
        });
        setEditingRate(null);
      } else {
        await createRateMutation.mutateAsync({
          label: formData.label,
          roomTypeId: formData.roomTypeId,
          price: formData.price || undefined,
          startDate: new Date(formData.startDate),
          endDate: new Date(formData.endDate),
          discountType: formData.discountType,
          discountPercent: formData.discountType === 'PERCENTAGE' ? formData.discountPercent : undefined,
          discountAmount: formData.discountType === 'FIXED' ? formData.discountAmount : undefined,
          minNights: formData.minNights || undefined,
          promoCode: formData.promoCode || undefined,
          isActive: formData.isActive,
          paymentMethods: formData.paymentMethods.length ? formData.paymentMethods : undefined,
        });
        toast({
          title: '🎉 Promoción creada',
          description: `"${formData.label}" ya está disponible`,
        });
        setIsCreateDialogOpen(false);
      }
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la tarifa',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (rate: Rate) => {
    setFormData({
      label: rate.label,
      roomTypeId: rate.roomTypeId,
      price: rate.price,
      startDate: format(new Date(rate.startDate), 'yyyy-MM-dd'),
      endDate: format(new Date(rate.endDate), 'yyyy-MM-dd'),
      discountType: rate.discountType || 'PERCENTAGE',
      discountPercent: rate.discountPercent || 0,
      discountAmount: rate.discountAmount || 0,
      minNights: rate.minNights || 1,
      promoCode: rate.promoCode || '',
      isActive: rate.isActive,
      paymentMethods: rate.paymentMethods || [],
    });
    setEditingRate(rate);
  };

  const handleToggleActive = async (rate: Rate) => {
    await updateRateMutation.mutateAsync({
      id: rate.id,
      data: { isActive: !rate.isActive },
    });
    toast({
      title: rate.isActive ? '⏸️ Promoción pausada' : '▶️ Promoción activada',
    });
  };

  const handleDelete = async (id: string) => {
    await deleteRateMutation.mutateAsync(id);
    toast({
      title: '🗑️ Tarifa eliminada',
    });
  };

  const handleSaveBasePrice = async (roomTypeId: string, newPrice: number) => {
    try {
      await updateRoomTypeMutation.mutateAsync({
        id: roomTypeId,
        data: { basePrice: newPrice },
      });
      setEditingBasePrice(null);
      toast({
        title: '💰 Precio base actualizado',
        description: 'El cambio se aplicará a nuevas reservas',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el precio base',
        variant: 'destructive',
      });
    }
  };

  const copyPromoCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: '📋 Código copiado',
      description: code,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarifas y Reportes"
        description="Promociones, precios y estadísticas del hotel"
        actions={
          <Button
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/30 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Promoción
          </Button>
        }
      />

      <Tabs defaultValue="rates" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="rates">Tarifas</TabsTrigger>
          <TabsTrigger value="stats">Estadísticas</TabsTrigger>
        </TabsList>

        <TabsContent value="rates" className="space-y-6">
      {/* Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SeasonalityChart rates={rates} />
        </div>
        <div>
          <RateCalendarWidget />
        </div>
      </div>

      {/* Base Rates Cards - Editable */}
      <Card className="glass border-none shadow-lg">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Tag className="w-5 h-5 text-purple-500" />
            Tarifas Base por Categoría
          </CardTitle>
          <CardDescription>Click en el precio para editarlo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {roomTypes.map(type => (
              <motion.div
                key={type.id}
                whileHover={{ scale: 1.02 }}
                className="p-5 rounded-2xl border border-purple-100 dark:border-purple-900/30 bg-gradient-to-br from-purple-50/50 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/20 backdrop-blur-md"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">Hab. {type.maxGuests} personas</span>
                  <Badge variant="outline" className="border-purple-200 text-purple-600 bg-purple-50 dark:bg-purple-900/20 text-xs">
                    Base
                  </Badge>
                </div>

                {editingBasePrice?.id === type.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold">$</span>
                    <Input
                      type="number"
                      value={editingBasePrice.price}
                      onChange={e => setEditingBasePrice({ ...editingBasePrice, price: Number(e.target.value) })}
                      className="text-2xl font-bold h-12 w-28"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" onClick={() => handleSaveBasePrice(type.id, editingBasePrice.price)}>
                      <Check className="w-4 h-4 text-emerald-500" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingBasePrice(null)}>
                      <X className="w-4 h-4 text-rose-500" />
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingBasePrice({ id: type.id, price: type.basePrice })}
                    className="text-3xl font-bold text-slate-900 dark:text-white cursor-pointer hover:text-purple-600 transition-colors"
                  >
                    ${type.basePrice.toLocaleString('es-AR')}
                  </div>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  por noche • máx. {type.maxGuests} huéspedes
                </p>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Promotions Table */}
      <Card className="glass border-none shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Promociones y Ofertas
              </CardTitle>
              <CardDescription>{promotions.length} promociones configuradas</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {promotions.length === 0 ? (
            <div className="text-center py-12">
              <Percent className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground mb-4">No hay promociones configuradas</p>
              <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Crear primera promoción
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-200 dark:border-slate-800">
                  <TableHead>Promoción</TableHead>
                  <TableHead>Aplicado a</TableHead>
                  <TableHead>Precio/Descuento</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Métodos de pago</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {promotions.map(rate => (
                    <motion.tr
                      key={rate.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -100 }}
                      className="border-slate-200 dark:border-slate-800 hover:bg-white/30 dark:hover:bg-slate-800/30"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            isCurrentlyActive(rate) ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          )} />
                          <div>
                            <p className="font-semibold">{rate.label}</p>
                            {rate.minNights && rate.minNights > 1 && (
                              <p className="text-xs text-muted-foreground">Mín. {rate.minNights} noches</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getRoomTypeName(rate.roomTypeId) || 'Todas'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-bold text-slate-700 dark:text-slate-300">
                            ${rate.price.toLocaleString('es-AR')}
                          </p>
                          {rate.discountPercent && rate.discountPercent > 0 && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs">
                              -{rate.discountPercent}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rate.promoCode ? (
                          <div
                            onClick={() => copyPromoCode(rate.promoCode!)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md font-mono text-xs cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            {rate.promoCode}
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rate.paymentMethods && rate.paymentMethods.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {rate.paymentMethods.map(m => (
                              <Badge key={m} variant="outline" className="text-xs px-1.5 py-0">
                                {PAYMENT_METHOD_LABELS[m] || m}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Todos</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="space-y-0.5">
                          <p>{format(new Date(rate.startDate), 'dd MMM', { locale: es })}</p>
                          <p>{format(new Date(rate.endDate), 'dd MMM yyyy', { locale: es })}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rate.isActive}
                          onCheckedChange={() => handleToggleActive(rate)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(rate)}>
                            <Edit className="w-4 h-4 text-slate-500" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <Trash2 className="w-4 h-4 text-rose-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminar promocion?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta accion no se puede deshacer. La promocion "{rate.label}" sera eliminada permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(rate.id)}
                                  className="bg-destructive hover:bg-destructive/90"
                                >
                                  Eliminar
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        <TabsContent value="stats">
          <Suspense fallback={<div className="text-center py-12 text-muted-foreground">Cargando estadísticas...</div>}>
            <StatisticsContent />
          </Suspense>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen || !!editingRate} onOpenChange={() => {
        setIsCreateDialogOpen(false);
        setEditingRate(null);
        resetForm();
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-purple-500" />
              {editingRate ? 'Editar Promoción' : 'Nueva Promoción'}
            </DialogTitle>
            <DialogDescription>
              Configura una tarifa especial o descuento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Nombre de la promoción *</Label>
                <Input
                  placeholder="Ej: Oferta Fin de Semana"
                  value={formData.label}
                  onChange={e => setFormData({ ...formData, label: e.target.value })}
                />
              </div>

              <div>
                <Label>Tipo de habitación</Label>
                <Select
                  value={formData.roomTypeId}
                  onValueChange={v => setFormData({ ...formData, roomTypeId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las categorías</SelectItem>
                    {roomTypes.map(rt => (
                      <SelectItem key={rt.id} value={rt.id}>Hab. {rt.maxGuests} personas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Precio promocional *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    className="pl-7"
                    placeholder="0"
                    value={formData.price || ''}
                    onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Fecha inicio *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Fecha fin *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <div className="col-span-2">
                <Label>Tipo de descuento</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={v => setFormData({ ...formData, discountType: v as DiscountType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Porcentaje (%)</SelectItem>
                    <SelectItem value="FIXED">Monto fijo ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.discountType === 'PERCENTAGE' ? (
                <div>
                  <Label>Descuento (%)</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.discountPercent || ''}
                      onChange={e => setFormData({ ...formData, discountPercent: Number(e.target.value) })}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
              ) : (
                <div>
                  <Label>Monto de descuento ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      className="pl-7"
                      placeholder="0"
                      value={formData.discountAmount || ''}
                      onChange={e => setFormData({ ...formData, discountAmount: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              <div>
                <Label>Mínimo de noches</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={formData.minNights || ''}
                  onChange={e => setFormData({ ...formData, minNights: Number(e.target.value) })}
                />
              </div>

              <div className="col-span-2">
                <Label>Código promocional</Label>
                <Input
                  placeholder="Ej: VERANO2026"
                  value={formData.promoCode}
                  onChange={e => setFormData({ ...formData, promoCode: e.target.value.toUpperCase() })}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Los huéspedes pueden usar este código al reservar
                </p>
              </div>
            </div>

            {/* Payment methods */}
            <div>
              <Label className="mb-2 block">Métodos de pago aceptados</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => {
                  const isSelected = formData.paymentMethods.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          paymentMethods: isSelected
                            ? prev.paymentMethods.filter(m => m !== key)
                            : [...prev.paymentMethods, key],
                        }));
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                        isSelected
                          ? "bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {formData.paymentMethods.length === 0
                  ? 'Sin selección = todos los métodos aceptados'
                  : `${formData.paymentMethods.length} método(s) seleccionado(s)`}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg">
              <div>
                <p className="font-medium text-sm">Promoción activa</p>
                <p className="text-xs text-muted-foreground">La promoción se aplicará automáticamente</p>
              </div>
              <Switch
                checked={formData.isActive}
                onCheckedChange={c => setFormData({ ...formData, isActive: c })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              setEditingRate(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.label || !formData.startDate || !formData.endDate || (formData.discountType === 'PERCENTAGE' ? !formData.discountPercent : !formData.discountAmount)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {editingRate ? 'Guardar Cambios' : 'Crear Promoción'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
