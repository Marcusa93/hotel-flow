import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { User, BellRing } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Deja claro, antes de guardar, si esa persona se entera o no. */
export function AssignmentHint({
  assigneeName,
  typedName,
  hasStaff,
}: {
  assigneeName?: string;
  typedName: string;
  hasStaff: boolean;
}) {
  const typed = typedName.trim();
  if (!typed) return null;

  if (assigneeName) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
        <BellRing className="w-3 h-3 shrink-0" />
        Le llega la notificación a {assigneeName}
      </p>
    );
  }

  if (!hasStaff) return null;

  return (
    <p className="text-xs text-amber-600 dark:text-amber-500">
      {typed} no tiene usuario con rol Limpieza: queda anotado, pero no recibe aviso.
    </p>
  );
}

interface StaffComboboxProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
}

export function StaffCombobox({
  value,
  onChange,
  suggestions,
  placeholder = 'Nombre del responsable',
}: StaffComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s.toLowerCase() !== value.toLowerCase()
  );

  const showDropdown = inputFocused && value.length > 0 && filtered.length > 0;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setInputFocused(true);
          setIsOpen(true);
        }}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setInputFocused(false), 200);
        }}
      />
      {showDropdown && isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg py-1 max-h-[160px] overflow-y-auto">
          {filtered.map((name) => (
            <button
              key={name}
              type="button"
              className={cn(
                'w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors'
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(name);
                setIsOpen(false);
              }}
            >
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
