import "@testing-library/jest-dom";

/**
 * Lo que jsdom no trae y los desplegables de Radix sí usan.
 *
 * El Select se monta, mide y mueve el foco a la opción activa, y para eso llama
 * a cuatro cosas que jsdom no implementa. Sin ellas el componente no falla en el
 * assert: se cae en un efecto, o sea con el test ya contado como pasado y el
 * error apareciendo como "unhandled rejection" fuera de todo caso.
 *
 * Van acá y no en el test que los descubrió porque no son de él: cualquier
 * pantalla con un desplegable —que son casi todas— los necesita igual.
 */
if (typeof Element !== "undefined") {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
  // Los tres de puntero: Radix decide con ellos si el gesto es de mouse o de
  // toque. Devolver false es "no hay puntero capturado", que es la verdad en un
  // test que dispara eventos a mano.
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
