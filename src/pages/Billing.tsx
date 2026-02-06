import { useState } from 'react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, StubIndicator } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { BillingStats, InvoiceGallery } from '@/components/billing';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus } from 'lucide-react';

export default function Billing() {
  const { bookings, guests, rooms } = useHotel();

  // Mock Invoice generation from Bookings
  const invoices = bookings
    .filter(b => b.status === 'CHECKED_OUT' || b.status === 'CHECKED_IN')
    .slice(0, 6) // Show top 6 as recent visual cards
    .map((booking, idx) => ({
      booking,
      guest: guests.find(g => g.id === booking.guestId),
      room: rooms.find(r => r.id === booking.roomId),
      total: booking.totalAmount,
      date: new Date(booking.checkOutDate), // Treat checkout as invoice date
      number: `A-${2024000 + idx}`
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Facturación Inteligente"
        description="Emisión fiscal y control de documentos"
        actions={
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Factura
          </Button>
        }
      />

      {/* Stats Dashboard */}
      <BillingStats />

      {/* Main Content Actions */}
      <div className="mt-8">
        <Tabs defaultValue="gallery" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Documentos Recientes</h3>
            <TabsList className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
              <TabsTrigger value="gallery">Galería Visual</TabsTrigger>
              <TabsTrigger value="table">Listado Histórico</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="gallery" className="animate-in fade-in zoom-in-95 duration-300">
            <InvoiceGallery invoices={invoices} />
          </TabsContent>

          <TabsContent value="table">
            <div className="h-64 flex items-center justify-center bg-white/40 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300">
              <p className="text-muted-foreground">Listado completo (Implementación futura)</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
