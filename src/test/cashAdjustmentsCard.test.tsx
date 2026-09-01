import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashAdjustmentsCard } from '@/components/cash/CashAdjustmentsCard';
import type { AdjustmentGroup } from '@/lib/cashClosing';

// El formulario de ajustes arma las patas con el signo correcto: es lo único
// que separa "moví $50.000 de efectivo a transferencia" de un desastre
// contable con la misma cara. El componente recibe callbacks, así que acá se
// prueba el gesto completo sin base de por medio.

const abrir = (over: Partial<Parameters<typeof CashAdjustmentsCard>[0]> = {}) => {
  const onCreate = vi.fn();
  const onDelete = vi.fn();
  render(
    <CashAdjustmentsCard
      groups={[]}
      showForm
      canDelete
      onCreate={onCreate}
      onDelete={onDelete}
      {...over}
    />
  );
  return { onCreate, onDelete };
};

const boton = () => screen.getByRole('button', { name: /registrar ajuste/i });

/** Elige una opción de un desplegable de Radix: abrir y clickear, como el admin. */
const elegir = async (combo: HTMLElement, nombre: RegExp) => {
  fireEvent.click(combo);
  const opcion = await screen.findByRole('option', { name: nombre });
  fireEvent.click(opcion);
};

describe('la tarjeta de ajustes de caja', () => {
  it('un cambio arma las dos patas: negativa en el origen, positiva en el destino', () => {
    const { onCreate } = abrir();
    // Modo "Cambio entre métodos" con Efectivo → Transferencia son los valores
    // con los que arranca: el caso más común no toca ningún desplegable.
    fireEvent.change(screen.getByPlaceholderText(/ej: 50000/i), { target: { value: '50000' } });
    fireEvent.change(screen.getByPlaceholderText(/transferencia/i), {
      target: { value: 'el huésped transfirió' },
    });
    fireEvent.click(boton());

    expect(onCreate).toHaveBeenCalledWith({
      legs: [
        { method: 'CASH', amount: -50_000 },
        { method: 'TRANSFER', amount: 50_000 },
      ],
      reason: 'el huésped transfirió',
    });
  });

  it('un retiro arma una sola pata negativa', async () => {
    const { onCreate } = abrir();
    const combos = screen.getAllByRole('combobox');
    await elegir(combos[0], /retiro o ingreso/i);

    fireEvent.change(screen.getByPlaceholderText(/ej: 50000/i), { target: { value: '80000' } });
    fireEvent.change(screen.getByPlaceholderText(/sueldo/i), {
      target: { value: 'sueldo de septiembre' },
    });
    fireEvent.click(boton());

    expect(onCreate).toHaveBeenCalledWith({
      legs: [{ method: 'CASH', amount: -80_000 }],
      reason: 'sueldo de septiembre',
    });
  });

  it('sin motivo no hay ajuste: el renglón es el rastro', () => {
    const { onCreate } = abrir();
    fireEvent.change(screen.getByPlaceholderText(/ej: 50000/i), { target: { value: '50000' } });
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('no deja mover plata de un método a sí mismo', async () => {
    const { onCreate } = abrir();
    const combos = screen.getAllByRole('combobox');
    // "Entra a" pasa a Efectivo, igual que "Sale de".
    await elegir(combos[2], /efectivo/i);

    fireEvent.change(screen.getByPlaceholderText(/ej: 50000/i), { target: { value: '50000' } });
    fireEvent.change(screen.getByPlaceholderText(/transferencia/i), { target: { value: 'x' } });

    expect(screen.getByText(/son el mismo/i)).toBeInTheDocument();
    expect(boton()).toBeDisabled();
    fireEvent.click(boton());
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('mirando un turno cerrado no hay formulario ni tacho, pero la lista queda', () => {
    const groups: AdjustmentGroup[] = [
      {
        kind: 'AJUSTE',
        ids: ['a-1'],
        method: 'CASH',
        amount: -80_000,
        reason: 'sueldo',
        createdAt: new Date(2026, 8, 1, 12, 0),
        createdByName: 'Marcos',
      },
    ];
    abrir({ groups, showForm: false, canDelete: false });

    expect(screen.getByText(/sueldo/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /registrar ajuste/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /deshacer ajuste/i })).not.toBeInTheDocument();
  });

  it('el tacho deshace el grupo entero, con las dos patas juntas', () => {
    const group: AdjustmentGroup = {
      kind: 'CAMBIO',
      ids: ['sale', 'entra'],
      fromMethod: 'CASH',
      toMethod: 'TRANSFER',
      amount: 50_000,
      reason: 'el huésped transfirió',
      createdAt: new Date(2026, 8, 1, 12, 0),
    };
    const { onDelete } = abrir({ groups: [group] });

    fireEvent.click(screen.getByRole('button', { name: /deshacer ajuste/i }));
    expect(onDelete).toHaveBeenCalledWith(group);
  });
});
