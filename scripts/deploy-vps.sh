#!/usr/bin/env bash
#
# Despliega el front en la VPS. Se corre EN LA VPS, en /opt/homeapp.
#
#   ssh root@2.25.185.242
#   cd /opt/homeapp && git pull --ff-only && ./scripts/deploy-vps.sh
#
# Existe por lo que pasó con Vercel: los deploys salían de lo que hubiera en la
# carpeta en ese momento, y un 12 de octubre eso era una rama sin mergear con un
# commit de diez días antes. Nadie se enteró hasta que el dueño reportó que una
# función "no estaba". Acá, si algo no está como corresponde, no se despliega.
#

set -euo pipefail

DESTINO="${DESTINO:-/var/www/homeapp}"
RAMA="${RAMA:-main}"

rojo()  { printf '\033[31m%s\033[0m\n' "$1"; }
verde() { printf '\033[32m%s\033[0m\n' "$1"; }
paso()  { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }

cortar() { rojo "✗ $1"; exit 1; }

# ─── 1. Que se despliegue lo que creemos que se despliega ────────────────
paso "Verificando el repositorio"

rama_actual=$(git rev-parse --abbrev-ref HEAD)
[ "$rama_actual" = "$RAMA" ] || cortar "Estás en '$rama_actual'. Producción sale de '$RAMA'."

# Cambios sin commitear significan que lo que se sube no está en ningún lado:
# si rompe, no hay con qué volver atrás ni forma de saber qué se subió.
[ -z "$(git status --porcelain)" ] || cortar "Hay cambios sin commitear. Guardalos o descartalos."

git fetch --quiet origin "$RAMA"
local_sha=$(git rev-parse HEAD)
remoto_sha=$(git rev-parse "origin/$RAMA")
if [ "$local_sha" != "$remoto_sha" ]; then
    rojo "✗ Tu '$RAMA' no coincide con el remoto."
    echo "    local:  $local_sha"
    echo "    remoto: $remoto_sha"
    echo "    Corré 'git pull --ff-only' y volvé a intentar."
    exit 1
fi

verde "✓ $RAMA al día, en $(git rev-parse --short HEAD)"

# ─── 2. Que ande ─────────────────────────────────────────────────────────
paso "Instalando dependencias"
npm ci --silent

paso "Typecheck"
npx tsc -p tsconfig.app.json --noEmit

paso "Tests"
npx vitest run

# ─── 3. Build ────────────────────────────────────────────────────────────
# Las variables de Vite se hornean acá adentro: si cambió el .env, este es el
# momento en que se aplica. Reiniciar nginx después no cambia nada.
paso "Compilando"
[ -f .env ] || cortar "Falta el archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY."
npm run build

[ -f dist/index.html ] || cortar "El build no generó dist/index.html."

# ─── 4. Publicar ─────────────────────────────────────────────────────────
# --delete saca los assets de la versión anterior: tienen hash en el nombre, así
# que nadie los pide una vez que el index.html nuevo está arriba, y acumularlos
# llena el disco con el tiempo.
paso "Publicando en $DESTINO"
mkdir -p "$DESTINO"
rsync -a --delete dist/ "$DESTINO/"

# Caddy sirve archivos del disco, así que no hay que recargarlo: el próximo
# pedido ya lee lo nuevo. Sólo hace falta tocarlo si cambia /etc/caddy.
chown -R caddy:caddy "$DESTINO"

verde ""
verde "✓ Desplegado $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"
echo
echo "  Verificá que llegó de verdad, sin depender de lo que se vea en pantalla:"
echo "    H=https://homeapp.2-25-185-242.sslip.io"
echo "    IDX=\$(curl -s \$H/ | grep -o '/assets/index-[^\"]*\.js' | head -1)"
echo "    curl -s \$H\$IDX | grep -o 'assets/Bookings-[A-Za-z0-9_-]*\.js' | head -1"
echo
echo "  Si no ves el cambio en el navegador es caché del navegador, no del"
echo "  servidor: Caddy manda no-store en el index.html."
