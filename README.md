# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Create your local env file (see .env.example for the required keys).
#         .env.local is gitignored; production values live in the Vercel dashboard.
cp .env.example .env.local

# Step 5: Start the development server with auto-reloading and an instant preview.
npm run dev
```

The dev server runs on port **8080** (see `vite.config.ts`).

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Despliegue en la VPS

El front vive en la VPS (`2.25.185.242`, junto a otros proyectos) y la base
sigue en Supabase: desplegar no toca datos, sólo reemplaza archivos estáticos.

Se migró desde Vercel en octubre de 2026. El motivo está en el comentario de
`deploy/homeapp.caddy`: los deploys salían por CLI desde la carpeta local, y uno
hecho desde una rama sin mergear estuvo tres semanas en producción sin que nadie
lo notara.

### Dónde está qué

| | |
|---|---|
| Clon que se compila | `/opt/homeapp` (rama `main`) |
| Archivos que sirve Caddy | `/var/www/homeapp` |
| Configuración del sitio | `/etc/caddy/homeapp.caddy`, importado desde el Caddyfile |
| Acceso sin DNS | `https://homeapp.2-25-185-242.sslip.io` |

`/home/bothotelflow/hotel-flow` es **otra cosa**: el clon del bot de Telegram,
con su propio servicio corriendo. No se toca para desplegar.

### Actualizar producción

```bash
ssh root@2.25.185.242
cd /opt/homeapp && git pull --ff-only && ./scripts/deploy-vps.sh
```

El script se niega a desplegar si no estás en `main`, si hay cambios sin
commitear, si tu rama no coincide con el remoto, o si fallan el typecheck o los
tests.

### Primera instalación (ya hecha, queda documentado)

```bash
git clone --branch main https://github.com/Marcusa93/hotel-flow.git /opt/homeapp
cd /opt/homeapp

# Las dos únicas variables que usa el build. La anon key es pública por diseño:
# viaja dentro del bundle que descarga cualquier visitante.
cat > .env <<'ENV'
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
ENV

cp deploy/homeapp.caddy /etc/caddy/homeapp.caddy
echo 'import /etc/caddy/homeapp.caddy' >> /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile   # ANTES de recargar
systemctl reload caddy

./scripts/deploy-vps.sh
```

El `caddy validate` antes de recargar no es ceremonia: en esa máquina viven
otros proyectos y una recarga con la configuración rota los deja caídos a todos.

### Dos cosas que importan

**Las variables se hornean en el build.** Vite las mete adentro del bundle al
compilar. Si cambia el `.env`, hay que volver a correr el script; recargar Caddy
no alcanza.

**El `index.html` no se cachea, y tiene que seguir así.** Está resuelto en
`deploy/homeapp.caddy` por descarte: todo lo que no sea `/assets/*` va con
`no-store`. Si se cacheara, el navegador seguiría pidiendo los assets de la
versión anterior y el usuario vería código viejo aunque el deploy haya salido
bien — el mismo síntoma que motivó la migración, pero por causa propia.

### Verificar qué versión está arriba

Sin depender de lo que se vea en pantalla:

```bash
H=https://homeapp.com.ar
IDX=$(curl -s $H/ | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -s $H$IDX | grep -o 'assets/Bookings-[A-Za-z0-9_-]*\.js' | head -1
# y después, en ese chunk, buscar alguna cadena de la versión esperada
```

### Cloudflare

El dominio se delegó a Cloudflare en NIC.ar. Los registros A de `homeapp.com.ar`
y `www` apuntan a `2.25.185.242` **en nube gris (DNS only)**: proxeados,
Cloudflare terminaría el TLS y Caddy no podría emitir el certificado.

Los registros CAA autorizan a `letsencrypt.org`, que es la CA que usa Caddy. Si
se borran dejando sólo las otras, el certificado deja de renovarse.

## Supabase keepalive

This repo includes a dedicated Supabase keepalive mechanism for production so a Supabase Free project does not get paused for inactivity. It does not touch any business tables, product flows, or application logic.

What was added:

- `supabase/migrations/20260421123000_supabase_keepalive.sql` creates the `api` schema if needed, a dedicated `api.supabase_keepalive` table, and an idempotent `api.keepalive()` RPC that only upserts a single fixed row.
- `.github/workflows/supabase-keepalive.yml` runs on a GitHub Actions schedule twice per day and calls the Supabase RPC directly.

Required setup:

- Add `api` to the Supabase project's exposed schemas in `Project Settings -> API` if it is not already exposed.
- Add these GitHub repository secrets:
  - `SUPABASE_PROJECT_URL`
  - `SUPABASE_ANON_KEY`

The workflow uses the anon key intentionally because only the `api.keepalive()` RPC is exposed for anon execution. The underlying table is still kept behind database-owned writes.

Manual test:

```sh
curl --silent --show-error --fail-with-body \
  -X POST \
  "${SUPABASE_PROJECT_URL%/}/rest/v1/rpc/keepalive" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: api" \
  -H "Content-Profile: api" \
  -d '{}'
```

Expected response:

```json
{"ok":true,"timestamp":"2026-04-21T12:34:56.789Z"}
```

Adjust or disable the schedule:

- Edit `.github/workflows/supabase-keepalive.yml` to change the `cron` entries.
- Disable the `Supabase Keepalive` workflow in GitHub Actions if the project no longer needs it.

## Bot de Telegram (control remoto del repo)

Este repo se opera principalmente desde el celular a través de un bot de Telegram que corre en la
misma VPS que aloja el servidor de desarrollo.

**Qué hace el bot:**

- Recibe mensajes de texto (o adjuntos: fotos, documentos) y los ejecuta como tareas de
  Claude Code sobre este repo en modo headless.
- Mantiene contexto entre mensajes usando `--resume` con un session-id por chat persistido en
  `sessions.json`. `/nuevo` reinicia el contexto.
- Muestra progreso en vivo: edita un mensaje de Telegram con la herramienta y archivo actuales
  mientras Claude trabaja.
- Encola los mensajes que llegan durante una tarea en vez de rechazarlos.
- Las reglas de trabajo del repo (`dev-rules.md`) se inyectan como system prompt en cada tarea,
  de modo que Claude sabe que está en producción, no hacer deletes sin backup, etc.

**Comandos disponibles:**

| Comando | Qué hace |
| --- | --- |
| `/estado` | Rama, cambios sin commitear, últimos commits, cola activa, tamaño de sesión |
| `/diff` | Cambios sin commitear |
| `/log` | Últimos 10 commits |
| `/cola` | Tarea en curso y encoladas |
| `/cancelar` | Corta la tarea en curso |
| `/nuevo` | Reinicia el contexto de conversación |
| `/pwd` | Carpeta de trabajo del bot |

**Dónde vive:**

El código del bot está en `/home/bothotelflow/telegram-claude-bot/` en la VPS (fuera de este repo).
Corre como servicio systemd (`claude-tg-hotelflow`) bajo el usuario `bothotelflow` y accede al
repo por deploy key SSH propia.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
