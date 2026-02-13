import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface DateRangeSelectorProps {
  dateRange: { from: Date; to: Date };
  onDateRangeChange: (range: { from: Date; to: Date }) => void;
}

const presets = [
  { label: '7 días', getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Este mes', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mes anterior', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Este año', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
];

export function DateRangeSelector({ dateRange, onDateRangeChange }: DateRangeSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="hidden lg:flex gap-1">
        {presets.map(preset => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => onDateRangeChange(preset.getRange())}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-8 gap-2 text-xs font-normal')}>
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {format(dateRange.from, 'dd MMM', { locale: es })} — {format(dateRange.to, 'dd MMM', { locale: es })}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="flex">
            <Calendar
              mode="range"
              selected={{ from: dateRange.from, to: dateRange.to }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onDateRangeChange({ from: range.from, to: range.to });
                } else if (range?.from) {
                  onDateRangeChange({ from: range.from, to: range.from });
                }
              }}
              numberOfMonths={2}
              locale={es}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
