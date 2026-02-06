import { Wrench } from 'lucide-react';

interface StubIndicatorProps {
  message?: string;
}

export function StubIndicator({ message = 'Se conectará a backend' }: StubIndicatorProps) {
  return (
    <div className="stub-indicator">
      <Wrench className="w-3 h-3" />
      <span>{message}</span>
    </div>
  );
}
