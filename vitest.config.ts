import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Todo el sistema lee el calendario local: a qué caja entra un cobro, qué día
    // se cierra, qué mes suma. Los tests corren en el huso del hotel (UTC-3) para
    // que prueben lo que va a pasar en el mostrador, y no lo que pasaría en la
    // máquina de quien los corre —un CI o un contenedor arrancan en UTC, y ahí las
    // 21 de acá ya son del día siguiente—. Es el mismo huso que el trigger de
    // 20260805120000_correccion_fecha_cobro.sql deja escrito del lado del servidor.
    env: { TZ: "America/Argentina/Buenos_Aires" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
