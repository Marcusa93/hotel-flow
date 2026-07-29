import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppRole } from '@/context/AppRoleContext';
import { useAuth } from '@/context/AuthContext';
import { useUpdateGuest } from '@/hooks/useUpdateGuest';
import { toast } from '@/hooks/use-toast';
import { GUEST_RATINGS, GUEST_RATING_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Guest, GuestRating } from '@/types/hotel';
import { RATING_STYLES } from './GuestRatingBadge';

interface GuestRatingSectionProps {
  guest: Guest;
}

/**
 * Calificar al huésped desde su ficha.
 *
 * Guarda al toque y no dentro del modo Editar: marcar "no deseado" es lo que
 * hace el que acaba de tener el problema, y encima de eso pedirle que entre a
 * editar y confirme termina en que no lo carga nadie.
 */
export function GuestRatingSection({ guest }: GuestRatingSectionProps) {
  const updateGuest = useUpdateGuest();
  const { currentRole, profileName } = useAppRole();
  const { user } = useAuth();
  const [notesDraft, setNotesDraft] = useState(guest.ratingNotes || '');
  const [savingRating, setSavingRating] = useState<GuestRating | 'CLEAR' | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  // Cambiar de huésped sin cerrar el panel dejaba el detalle del anterior en la
  // caja de texto, listo para guardarse sobre el nuevo.
  useEffect(() => {
    setNotesDraft(guest.ratingNotes || '');
  }, [guest.id, guest.ratingNotes]);

  const canRate = currentRole === 'admin' || currentRole === 'reception';
  const author = profileName || user?.email || undefined;
  const notesChanged = notesDraft.trim() !== (guest.ratingNotes || '').trim();

  const applyRating = async (rating: GuestRating | null) => {
    setSavingRating(rating ?? 'CLEAR');
    try {
      await updateGuest.mutateAsync({
        id: guest.id,
        data: rating
          ? { rating, ratingBy: author ?? null, ratingAt: new Date() }
          // Sacar la calificación se lleva el motivo y la firma: dejarlos sería
          // un texto sin etiqueta que nadie sabe a qué corresponde.
          : { rating: null, ratingNotes: null, ratingBy: null, ratingAt: null },
      });
      if (!rating) setNotesDraft('');
      toast({
        title: rating ? `Calificado: ${GUEST_RATING_LABELS[rating]}` : 'Calificación quitada',
        description: guest.fullName,
      });
    } catch (error) {
      toast({
        title: 'No se pudo guardar',
        description: 'Intentá de nuevo',
        variant: 'destructive',
      });
    } finally {
      setSavingRating(null);
    }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await updateGuest.mutateAsync({
        id: guest.id,
        data: {
          ratingNotes: notesDraft.trim() || null,
          ratingBy: author ?? null,
          ratingAt: new Date(),
        },
      });
      toast({ title: 'Detalle guardado', description: guest.fullName });
    } catch (error) {
      toast({ title: 'No se pudo guardar', description: 'Intentá de nuevo', variant: 'destructive' });
    } finally {
      setSavingNotes(false);
    }
  };

  const style = guest.rating ? RATING_STYLES[guest.rating] : null;

  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
        Calificación interna
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        Para el hotel. No se imprime en la ficha ni sale en las exportaciones.
      </p>

      {!canRate ? (
        guest.rating && style ? (
          <div className={cn('p-4 rounded-xl border', style.panel)}>
            <p className={cn('font-semibold text-sm', style.accent)}>
              {GUEST_RATING_LABELS[guest.rating]}
            </p>
            {guest.ratingNotes && (
              <p className="text-sm mt-1 leading-relaxed">{guest.ratingNotes}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">Sin calificar.</p>
        )
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {GUEST_RATINGS.map(option => {
              const optionStyle = RATING_STYLES[option.value];
              const Icon = optionStyle.icon;
              const isActive = guest.rating === option.value;
              const isSaving = savingRating === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={!!savingRating}
                  onClick={() => applyRating(isActive ? null : option.value)}
                  title={option.hint}
                  className={cn(
                    'text-left p-3 rounded-xl border transition-all disabled:opacity-60',
                    isActive
                      ? cn(optionStyle.panel, 'ring-2 ring-offset-1 ring-current', optionStyle.accent)
                      : 'border-border bg-muted/30 hover:bg-muted/60 text-foreground'
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Icon className={cn('w-4 h-4 shrink-0', isActive ? '' : 'text-muted-foreground')} />
                    )}
                    {option.label}
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          {guest.rating ? (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Qué pasó
                </Label>
                <Textarea
                  value={notesDraft}
                  onChange={e => setNotesDraft(e.target.value)}
                  placeholder="Ej: se fue debiendo el minibar y discutió en recepción. 12/07."
                  className="min-h-[90px]"
                />
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={saveNotes}
                    disabled={!notesChanged || savingNotes}
                  >
                    {savingNotes ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Guardar detalle
                  </Button>
                  {notesChanged && !savingNotes && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setNotesDraft(guest.ratingNotes || '')}
                    >
                      Descartar
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-muted-foreground"
                    disabled={!!savingRating}
                    onClick={() => applyRating(null)}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Quitar calificación
                  </Button>
                </div>
              </div>

              {(guest.ratingBy || guest.ratingAt) && (
                <p className="text-[11px] text-muted-foreground">
                  {guest.ratingBy ? `Cargado por ${guest.ratingBy}` : 'Cargado'}
                  {guest.ratingAt
                    ? ` · ${format(guest.ratingAt, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es })}`
                    : ''}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sin calificar. Elegí una opción para dejar registro de cómo se portó.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
