/**
 * La tipografía del hotel en lo que se imprime.
 *
 * Cada pantalla que imprime arma su propio documento con window.open y su
 * propio <style>, así que ninguna heredaba nada de la app: el listado de
 * huéspedes salía en Segoe UI, el cierre de caja en la fuente del sistema y la
 * vista previa de factura pedía 'Inter', que no se carga en ningún lado y caía
 * en cualquier cosa. Seis papeles del mismo hotel con cuatro tipografías, y
 * ninguna la del hotel.
 *
 * Peor: Segoe UI y Tahoma dependen de lo que tenga instalado la máquina desde
 * donde se imprime. El mismo cierre de caja salía distinto en dos computadoras
 * del mismo mostrador.
 */

/**
 * Va en el <head> del documento a imprimir, antes del <style>.
 *
 * Si la impresión sale sin conexión, el navegador cae en las fuentes de
 * respaldo declaradas abajo y el papel sigue siendo legible: se pierde la
 * identidad, no el contenido.
 */
export const PRINT_FONT_LINK = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..900&family=Hanken+Grotesk:wght@300..800&display=swap" rel="stylesheet">`;

/**
 * Va adentro del <style>, antes de los estilos propios de cada documento.
 *
 * Mismo reparto que en pantalla: Fraunces para los títulos y para los totales,
 * Hanken Grotesk para el cuerpo. Las cifras van con cifras tabulares para que
 * las columnas de plata queden alineadas por la coma, que en papel importa más
 * que en pantalla porque se leen de arriba abajo.
 */
export const PRINT_FONT_CSS = `
  body { font-family: 'Hanken Grotesk', system-ui, -apple-system, sans-serif; }
  h1, h2, h3, .num-display {
    font-family: 'Fraunces', Georgia, serif;
    font-optical-sizing: auto;
  }
  .num-display, .num, .total, td.num {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
  }`;
