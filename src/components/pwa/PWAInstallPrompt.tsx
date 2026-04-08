import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function PWAInstallPrompt() {
  const { showPrompt, isInstalled, canNativeInstall, install, dismiss } = usePWAInstall();

  if (isInstalled || !showPrompt) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 md:bottom-6 left-3 right-3 md:left-auto md:right-6 md:max-w-sm z-[60] rounded-2xl bg-card border border-border shadow-2xl p-4"
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Download className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight">
              Instalá HoMe en tu celular
            </h3>
            {canNativeInstall ? (
              <p className="text-xs text-muted-foreground mt-1">
                Accedé más rápido desde tu pantalla de inicio, sin abrir el navegador.
              </p>
            ) : isIOS ? (
              <p className="text-xs text-muted-foreground mt-1">
                Tocá <Share className="inline w-3.5 h-3.5 -mt-0.5 text-primary" /> en Safari y luego <strong>"Agregar a inicio"</strong>.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Abrí el menú del navegador (⋮) y tocá <strong>"Agregar a pantalla de inicio"</strong>.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            className="flex-1 text-xs"
          >
            Ahora no
          </Button>
          {canNativeInstall ? (
            <Button
              size="sm"
              onClick={install}
              className="flex-1 text-xs"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Instalar
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={dismiss}
              className="flex-1 text-xs"
            >
              Entendido
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
