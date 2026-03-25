import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-5">
        <Icon className="w-10 h-10 text-muted-foreground/40" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {action && (
        <Button onClick={action.onClick} className="mt-6 rounded-xl">
          {action.label}
        </Button>
      )}
    </div>
  );
}
