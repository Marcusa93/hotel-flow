import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Mail, Phone } from 'lucide-react';
import { useHotel } from '@/context/HotelContext';
import { PageHeader, EmptyState } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function Guests() {
  const { guests, bookings } = useHotel();
  const [search, setSearch] = useState('');

  const filteredGuests = useMemo(() => {
    return guests
      .filter(guest => {
        const searchLower = search.toLowerCase();
        return (
          guest.fullName.toLowerCase().includes(searchLower) ||
          guest.email.toLowerCase().includes(searchLower) ||
          guest.phone.includes(search) ||
          guest.documentId?.toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [guests, search]);

  const getGuestBookingsCount = (guestId: string) => 
    bookings.filter(b => b.guestId === guestId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Huéspedes"
        description={`${guests.length} huéspedes registrados`}
        actions={
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Huésped
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, email, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredGuests.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No se encontraron huéspedes"
          description={search ? "Intenta ajustar la búsqueda" : "Aún no hay huéspedes registrados"}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Reservas</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead>Notas</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGuests.map((guest) => (
                <TableRow key={guest.id}>
                  <TableCell className="font-medium">{guest.fullName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {guest.documentId || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {guest.email}
                      </span>
                      <span className="text-sm flex items-center gap-1 text-muted-foreground">
                        <Phone className="w-3 h-3" /> {guest.phone}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getGuestBookingsCount(guest.id)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(guest.createdAt), 'dd MMM yyyy', { locale: es })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {guest.notes || '-'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
