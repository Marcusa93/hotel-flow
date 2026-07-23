"""Deriva de brand/logo-homeapp.png las piezas que usa la app.

Se corre a mano cuando cambia el logo:

    python scripts/brand-assets.py

El master vive en brand/ y no en public/ a proposito: son 926 KB que Vite
copiaria tal cual al build y bajaria todo el que abre la app, para un archivo
que ninguna pantalla usa. Lo que se publica son las derivadas de acá abajo, que
juntas no llegan a 100 KB.

Dos cosas del master que hay que tener presentes:

1. Es un lockup —simbolo + "HomeApp" + bajada— pensado para papeleria. A 40px
   en el sidebar y a 16px en la pestaña del navegador el texto es una mancha,
   asi que para esos tamaños se recorta solo la casita.

2. Es navy sobre blanco, y el login es navy oscuro: la mitad del logo
   desapareceria. Por eso se genera una variante clara.

Requiere Pillow:  pip install Pillow
"""
import os
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(RAIZ, "brand", "logo-homeapp.png")
OUT = os.path.join(RAIZ, "public")

# Recortes medidos sobre el master de 1254x1254 buscando las bandas
# horizontales con tinta. Si cambia el logo, hay que volver a medirlas.
SIMBOLO = (330, 189, 916, 693)   # solo la casita
LOCKUP = (140, 189, 1114, 995)   # casita + palabra + bajada

# --sidebar-foreground del sistema de diseño (40 30% 92%)
CREMA = (240, 236, 227)


def quitar_blanco(im, umbral=238, suave=205):
    """Pasa el fondo a transparente conservando los colores de la marca.

    El umbral está en 238 y no cerca de 255 porque el master NO tiene fondo
    blanco liso: trae un damero tenue rasterizado encima —cuadros claros en 254,
    oscuros en 243— que quedó al exportar desde una herramienta que dibuja la
    transparencia como cuadriculado. Con el umbral en 246 los cuadros de 243
    salían con alfa 15 y el damero reaparecía sobre el navy del login. Nada del
    logo llega a 238: el navy y el dorado tienen su canal mínimo debajo de 90.

    No se desmultiplica el color contra el blanco a propósito. Eso corregiría el
    halo del antialias, pero corre el navy y el dorado hacia tonos que no son los
    de la marca. A los tamaños que se usan el halo no se ve; un dorado
    equivocado sí.
    """
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, _ = px[x, y]
            m = min(r, g, b)
            if m >= umbral:
                a = 0
            elif m <= suave:
                a = 255
            else:
                a = int(255 * (umbral - m) / (umbral - suave))
            px[x, y] = (r, g, b, a)
    return im


def aclarar_oscuros(im, limite=150):
    """Lleva el navy a crema para que el logo se lea sobre fondo oscuro.

    El dorado queda intacto: es el color que ya funciona sobre oscuro y es lo
    que ata la marca con los acentos de bronce de la app.
    """
    im = im.convert("RGBA")
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, b, a = px[x, y]
            if a and b > r and max(r, g, b) < limite + 60 and min(r, g, b) < limite:
                px[x, y] = (*CREMA, a)
    return im


def cuadrar(im, margen=0.08):
    """Centra en un lienzo cuadrado con aire, para que no toque los bordes."""
    w, h = im.size
    lado = int(max(w, h) * (1 + margen * 2))
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    lienzo.paste(im, ((lado - w) // 2, (lado - h) // 2), im)
    return lienzo


def guardar(im, nombre, ancho, colores=None):
    """Achica y cuantiza. El alfa se preserva aparte.

    quantize() sobre RGBA mete el alfa en la paleta y lo dithera, asi que la
    transparencia sale en damero —el mismo sintoma que el del master, por otra
    causa—. Se cuantiza solo el color y se vuelve a pegar el alfa, que no
    necesita paleta porque es practicamente binario.
    """
    alto = round(ancho * im.size[1] / im.size[0])
    im = im.resize((ancho, alto), Image.LANCZOS)

    if colores:
        alfa = im.getchannel("A")
        im = im.convert("RGB").quantize(
            colors=colores, method=Image.FASTOCTREE, dither=Image.NONE
        ).convert("RGB")
        im.putalpha(alfa)

    ruta = os.path.join(OUT, nombre)
    im.save(ruta, "PNG", optimize=True)
    print(f"  {nombre:<26} {ancho:>4}x{alto:<4} {os.path.getsize(ruta) / 1024:>6.1f} KB")


def main():
    master = Image.open(SRC)

    simbolo = cuadrar(quitar_blanco(master.crop(SIMBOLO)))
    lockup = quitar_blanco(master.crop(LOCKUP))

    print("sidebar:")
    # Se muestra a 40px; 256 cubre pantallas retina de sobra.
    guardar(simbolo, "brand-symbol.png", 256, colores=128)

    print("login:")
    # Se muestra a 208px de ancho.
    guardar(aclarar_oscuros(lockup), "brand-lockup-light.png", 440, colores=192)

    print("favicons:")
    # Sobre blanco solido: a 16px la casita calada contra una pestaña oscura
    # pierde todo el contraste del navy.
    fondo = Image.new("RGBA", simbolo.size, (255, 255, 255, 255))
    fondo.paste(simbolo, (0, 0), simbolo)
    for tam in (16, 32):
        guardar(fondo, f"favicon-{tam}.png", tam)

    ruta = os.path.join(OUT, "favicon.ico")
    fondo.resize((48, 48), Image.LANCZOS).save(
        ruta, sizes=[(16, 16), (32, 32), (48, 48)]
    )
    print(f"  {'favicon.ico':<26} 16/32/48 {os.path.getsize(ruta) / 1024:>6.1f} KB")

    hotel()


def hotel():
    """El isotipo del hotel cliente, para la banda del Dashboard.

    public/logo.png es el lockup del Hotel Mediterraneo: estrellas y arcos
    arriba, y debajo "MEDITERRANEO / HOTEL" en texto blanco —invisible sobre
    fondo claro, que es donde estaba usado hasta ahora—. En la banda del
    Dashboard el nombre del hotel ya aparece al lado, en un h1 que sale de
    hotelSettings, asi que el lockup completo lo decia dos veces.

    Se recorta solo el simbolo. Las bandas se midieron sobre los 426x164 del
    original: estrellas en y 2-19, arcos en y 29-72, y el texto recien desde
    y 93.
    """
    src = os.path.join(OUT, "logo.png")
    im = Image.open(src).convert("RGBA").crop((135, 0, 290, 80))

    ancho = 320  # se muestra a 36px de alto; sobra para retina
    alto = round(ancho * im.size[1] / im.size[0])
    im = im.resize((ancho, alto), Image.LANCZOS)

    ruta = os.path.join(OUT, "hotel-symbol.png")
    im.save(ruta, "PNG", optimize=True)
    print("hotel cliente:")
    print(f"  {'hotel-symbol.png':<26} {ancho:>4}x{alto:<4} {os.path.getsize(ruta) / 1024:>6.1f} KB")


if __name__ == "__main__":
    main()
