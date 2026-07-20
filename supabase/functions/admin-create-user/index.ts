import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Creating auth users requires the service_role key, which can never ship to the
// browser. This function holds it server-side and only acts for callers whose
// profile role is 'admin'.

const ALLOWED_ORIGINS = [
  "https://homeapp.com.ar",
  "https://www.homeapp.com.ar",
  "http://localhost:8080",
  "http://localhost:4173",
  "http://localhost:5173",
];

const ASSIGNABLE_ROLES = ["admin", "reception", "housekeeping", "auditor"];
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const CORS = makeCorsHeaders(req);

  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...CORS },
    });

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!supabaseUrl || !serviceKey) {
      return json({ error: "La función no está configurada correctamente." }, 500);
    }
    const admin = createClient(supabaseUrl, serviceKey);

    // ─── 1. The caller must be an authenticated admin ───────────────
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "No autenticado." }, 401);

    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) {
      return json({ error: "Tu sesión expiró. Volvé a iniciar sesión." }, 401);
    }

    const { data: callerProfile, error: profileErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", caller.user.id)
      .single();

    if (profileErr || callerProfile?.role !== "admin") {
      return json({ error: "Solo un administrador puede crear usuarios." }, 403);
    }

    // ─── 2. Validate the payload ────────────────────────────────────
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json({ error: "Datos inválidos." }, 400);
    }

    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const fullName = String(body.fullName || "").trim();
    const role = String(body.role || "");

    if (!EMAIL_RE.test(email)) {
      return json({ error: "El email no tiene un formato válido." }, 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return json(
        { error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.` },
        400,
      );
    }
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return json({ error: "El rol seleccionado no es válido." }, 400);
    }

    // ─── 3. Create the account ──────────────────────────────────────
    // email_confirm skips the verification email: hotel staff get their
    // credentials handed to them directly.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (createErr || !created?.user) {
      const raw = createErr?.message || "";
      const friendly = /already|exists|registered/i.test(raw)
        ? "Ya existe un usuario con ese email."
        : raw || "No se pudo crear el usuario.";
      return json({ error: friendly }, 400);
    }

    // ─── 4. Promote from 'pending' to the chosen role ───────────────
    // handle_new_user() already inserted the profile row as 'pending'.
    const { error: updateErr } = await admin
      .from("profiles")
      .update({
        role,
        must_change_password: true,
        ...(fullName ? { full_name: fullName } : {}),
      })
      .eq("id", created.user.id);

    if (updateErr) {
      // Don't leave an account nobody can use — undo the creation.
      await admin.auth.admin.deleteUser(created.user.id);
      return json(
        { error: `No se pudo asignar el rol: ${updateErr.message}` },
        500,
      );
    }

    return json({ id: created.user.id, email, role, fullName }, 200);
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : "Error inesperado." },
      500,
    );
  }
});
