import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { summarizeMovements } from '@/lib/heladera';
import type { MinibarMovement } from '@/types/hotel';
import { Refrigerator } from 'lucide-react';

const money = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

interface MonthlyMinibarCardProps {
    movements: MinibarMovement[];
}

/**
 * Cómo le fue a la heladera en el mes, para el resumen del dueño.
 *
 * Lo vendido acá NO se suma a lo que entró: esa plata ya está contada arriba
 * —el consumo del huésped en los cobros de su reserva, la venta de mostrador en
 * los ingresos externos— y sumarla otra vez la duplicaría. Este bloque contesta
 * otra pregunta: si la heladera deja plata, y cuánta se va sin dejarla.
 */
export function MonthlyMinibarCard({ movements }: MonthlyMinibarCardProps) {
    const s = summarizeMovements(movements);

    const huboMovimiento = movements.length > 0;
    const seFueSinVender = s.consumoPersonal.costo + s.merma.costo;

    return (
        <Card className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-white/20 shadow-sm">
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Refrigerator className="w-4 h-4 text-sky-500" /> Heladera
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                    Esta plata ya está contada arriba: el consumo del huésped entra con el cobro de su
                    reserva y la venta de mostrador en los ingresos externos. Acá se ve aparte para
                    saber si la heladera deja algo.
                </p>
            </CardHeader>

            <CardContent className="space-y-4">
                {!huboMovimiento ? (
                    <p className="text-sm text-muted-foreground">Sin movimientos este mes.</p>
                ) : (
                    <>
                        <div className="space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                                Lo que se vendió
                            </p>
                            <Renglon
                                label={`A huéspedes (${s.ventaHuesped.unidades} u.)`}
                                value={money(s.ventaHuesped.total)}
                            />
                            <Renglon
                                label={`En el mostrador (${s.ventaMostrador.unidades} u.)`}
                                value={money(s.ventaMostrador.total)}
                            />
                            <div className="flex justify-between pt-2 border-t font-bold">
                                <span>Vendido</span>
                                <span className="text-emerald-600 tabular-nums">{money(s.ventaTotal)}</span>
                            </div>
                            {s.costoVendido > 0 && (
                                <>
                                    <Renglon label="Lo que costó reponerlo" value={`− ${money(s.costoVendido)}`} />
                                    <div className="flex justify-between pt-2 border-t font-bold">
                                        <span>Ganancia de la heladera</span>
                                        <span className={s.margen >= 0 ? 'text-emerald-600 tabular-nums' : 'text-rose-600 tabular-nums'}>
                                            {money(s.margen)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* El número que no aparece en ningún otro lado */}
                        <div className="pt-3 border-t space-y-1">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                                Lo que salió sin venderse
                            </p>
                            <Renglon
                                label={`Se llevó el personal (${s.consumoPersonal.unidades} u.)`}
                                value={money(s.consumoPersonal.costo)}
                                hint="al costo"
                            />
                            {s.consumoPersonal.cobrado > 0 && (
                                <Renglon
                                    label="De eso, registrado a cobrar"
                                    value={money(s.consumoPersonal.cobrado)}
                                />
                            )}
                            <Renglon
                                label={`Mermas y roturas (${s.merma.unidades} u.)`}
                                value={money(s.merma.costo)}
                                hint="al costo"
                            />
                            <div className="flex justify-between pt-2 border-t font-bold">
                                <span>Salió sin dejar plata</span>
                                <span className="text-amber-600 dark:text-amber-400 tabular-nums">
                                    {money(seFueSinVender)}
                                </span>
                            </div>
                        </div>

                        {s.compras.unidades > 0 && (
                            <div className="pt-3 border-t">
                                <Renglon
                                    label={`Se repuso (${s.compras.unidades} u.)`}
                                    value={money(s.compras.total)}
                                />
                                {/* Que no lo cuenten dos veces al mirar el resultado del mes. */}
                                <p className="text-[11px] text-muted-foreground mt-2">
                                    La reposición no está incluida en los gastos de arriba salvo que además
                                    la hayan cargado en Gastos, que es donde sale la plata de verdad.
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

function Renglon({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
                {label}
                {hint && <span className="text-muted-foreground/70"> ({hint})</span>}
            </span>
            <span className="tabular-nums">{value}</span>
        </div>
    );
}
