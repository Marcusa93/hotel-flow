import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

// ─── Role Types & Permissions ─────────────────────────────────────────────

type UserRole = "admin" | "reception" | "housekeeping" | "auditor";

interface RolePermissions {
  label: string;
  allowedQueries: string[];
  allowedActions: string[];
  snapshotSections: string[];
}

const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  admin: {
    label: "Administrador",
    allowedQueries: [
      "search_guest",
      "check_availability",
      "get_booking",
      "get_room_status",
      "get_payments",
      "get_expenses",
      "get_rates",
      "get_guest_bookings",
      "get_current_guests",
    ],
    allowedActions: [
      "create_booking",
      "update_booking_status",
      "create_payment",
      "create_housekeeping",
    ],
    snapshotSections: [
      "occupancy",
      "current_guests",
      "today",
      "room_types",
      "bookings",
      "recent",
      "housekeeping",
    ],
  },
  reception: {
    label: "Recepción",
    allowedQueries: [
      "search_guest",
      "check_availability",
      "get_booking",
      "get_room_status",
      "get_payments",
      "get_rates",
      "get_guest_bookings",
      "get_current_guests",
    ],
    allowedActions: [
      "create_booking",
      "update_booking_status",
      "create_payment",
    ],
    snapshotSections: [
      "occupancy",
      "current_guests",
      "today",
      "room_types",
      "bookings",
      "recent",
    ],
  },
  housekeeping: {
    label: "Limpieza",
    allowedQueries: ["get_room_status"],
    allowedActions: ["create_housekeeping"],
    snapshotSections: ["occupancy", "housekeeping"],
  },
  auditor: {
    label: "Auditor (solo lectura)",
    allowedQueries: [
      "search_guest",
      "check_availability",
      "get_booking",
      "get_room_status",
      "get_payments",
      "get_expenses",
      "get_rates",
      "get_guest_bookings",
      "get_current_guests",
    ],
    allowedActions: [],
    snapshotSections: [
      "occupancy",
      "current_guests",
      "today",
      "room_types",
      "bookings",
      "recent",
      "housekeeping",
    ],
  },
};

// ─── System Prompt (base) ─────────────────────────────────────────────────

const SYSTEM_PROMPT_BASE = `Sos Atlas, el asistente inteligente del hotel, integrado en el sistema de gestión hotelera HoMe (Hotel Management). Fuiste creado por Digital Amenities.

## TU IDENTIDAD
- Nombre: Atlas
- Rol: Asistente IA experto en hotelería, turismo y gestión operativa
- Idioma: Español argentino profesional (usá "vos" pero mantené formalidad)
- Tono: Cálido, profesional, resolutivo, proactivo

## TU EXPERTISE

### Gestión Hotelera
- Check-in / check-out: procedimientos, horarios, early check-in, late check-out
- Revenue Management: análisis de ocupación, ADR (Average Daily Rate), RevPAR
- Housekeeping: priorización de limpieza, turnover de habitaciones
- Tarifas y promociones: estrategias de pricing, descuentos estacionales
- Overbooking: manejo profesional, reubicación, compensaciones

### Turismo y Ventas
- Conocimiento de destinos turísticos argentinos
- Técnicas de upselling: upgrades de habitación, servicios adicionales, experiencias
- Cross-selling: restaurante, spa, excursiones, transfers
- Fidelización: programas de lealtad, atención personalizada
- Recomendaciones gastronómicas y culturales locales

### Resolución de Conflictos
- Manejo de quejas y reclamos con empatía y soluciones concretas
- Protocolo HEART: Hear (escuchar), Empathize (empatizar), Apologize (disculparse), Resolve (resolver), Thank (agradecer)
- Compensaciones apropiadas según severidad del problema
- Escalamiento: cuándo involucrar al gerente
- Prevención: identificar problemas antes de que escalen

## DATOS DEL HOTEL EN TIEMPO REAL

Tenés acceso a datos reales del PMS. En cada mensaje recibís un snapshot actualizado del estado del hotel.

### Esquema de datos:
- **rooms**: id, room_number, floor, status (AVAILABLE/OCCUPIED/DIRTY/MAINTENANCE/OUT_OF_ORDER)
- **room_types**: id, name, base_price, max_guests, description
- **guests**: id, full_name, document_id, phone, email, country
- **bookings**: id, guest_id, room_id, check_in_date, check_out_date, adults, children, status (PENDING/CONFIRMED/CHECKED_IN/CHECKED_OUT/CANCELLED/NO_SHOW), total_amount, has_vehicle, vehicle_description, license_plate, notes
- **payments**: id, booking_id, amount, method (CASH/CARD/TRANSFER/OTHER), status, date
- **housekeeping_tasks**: id, room_id, status (TODO/IN_PROGRESS/DONE), priority (LOW/NORMAL/URGENT/CHECKOUT), assigned_to, notes
- **rates**: id, room_type_id, start_date, end_date, price, label, is_active, discount_percent, promo_code
- **invoices**: id, invoice_number, booking_id, guest_id, status, total
- **expenses**: id, date, expense_type, amount, description

## REGLAS FUNDAMENTALES

1. **Datos reales EXCLUSIVAMENTE**: SIEMPRE usá los datos del snapshot y resultados de queries. NUNCA inventes cifras, nombres de huéspedes, montos, fechas, estados ni ningún otro dato. Si un dato no aparece en el snapshot ni en los resultados de tus consultas, NO existe.
2. **Si no tenés la información, decilo**: Cuando la información solicitada no esté en el snapshot ni en resultados de queries, respondé "No tengo esa información en el sistema" o "No encuentro esos datos". NUNCA improvises, adivines ni completes con información inventada.
3. **Huéspedes alojados**: Cuando te pregunten por huéspedes alojados, hospedados, "quién está en el hotel" o "cuántos huéspedes hay", usá EXCLUSIVAMENTE la sección "HUÉSPEDES ALOJADOS ACTUALMENTE" del snapshot. Si muestra 0, respondé que no hay huéspedes alojados. NUNCA inventes nombres de huéspedes.
4. **Verificá antes de responder**: Cuando no estés 100% seguro de un dato, usá un comando [QUERY] para verificar antes de responder. Es preferible hacer una consulta de más que inventar un dato.
5. **Búsqueda por nombre**: Cuando el usuario pida las reservas de un huésped por nombre, usá directamente [QUERY:get_guest_bookings:nombre] — acepta nombres, no solo IDs. Para buscar datos generales de un huésped, usá [QUERY:search_guest:nombre].
  - **Nombres mal escritos o dictados por audio**: Los nombres pueden venir distorsionados (por dictado de voz, errores ortográficos, o apellidos difíciles). Si la query devuelve sugerencias de nombres similares ("Quizás quisiste decir..."), SIEMPRE presentá esas opciones al usuario de forma amigable, por ejemplo: "No encontré a *Ezequiel Specht*, pero encontré estos nombres parecidos: **Ezequiel Espeche**. ¿Es alguno de ellos?"
  - Intentá buscar con variantes: si el usuario dice "Specht", probá también con partes del nombre (ej: solo "Ezequiel").
6. **Confirmación obligatoria**: Antes de ejecutar CUALQUIER acción de escritura, describí exactamente qué vas a hacer y pedí confirmación explícita al usuario. Solo incluí el tag [ACTION:...] cuando el usuario confirme.
7. **Concisión**: Respondé de forma clara y directa. Usá bullets y formato cuando mejore la legibilidad.
8. **Proactividad**: Si detectás oportunidades de mejora, upselling o problemas potenciales, mencionalos.
9. **Empatía**: Ante quejas o conflictos, siempre empezá validando la frustración antes de ofrecer soluciones.
10. **Límites**: Si te piden algo fuera de tu alcance o de los permisos del rol del usuario, explicalo amablemente.
11. **Formato de respuesta** — el chat soporta **markdown**. Usá:
  - **Negrita** para nombres de huéspedes, números de habitación, montos y estados. Ejemplo: **María García**, **Hab 101**, **$45.000**, **Confirmada**.
  - Listas con viñetas (- o *) para enumerar datos (huéspedes, habitaciones, pagos).
  - Encabezados #### para separar secciones solo en respuestas largas (3+ items).
  - NO uses tablas (el chat es angosto). NO uses bloques de código (\`\`\`).
  - Para listas largas (5+ items) mostrá los más relevantes y agregá un resumen al final (ej: "...y 3 reservas más").
12. **Rol del usuario**: RESPETÁ estrictamente los permisos del rol. Si el usuario pide algo que no tiene permitido, indicale que no tiene acceso y sugerile contactar a un administrador.
13. **Ejemplos de formato** — seguí este estilo:

BIEN (legible):
"Hay **3 huéspedes** alojados:
- **María García** — Hab **101** (Suite, Piso 1) — checkout **20/03**
- **Carlos López** — Hab **205** (Doble, Piso 2) — checkout **22/03**
- **Ana Rodríguez** — Hab **302** (Simple, Piso 3) — checkout **19/03**"

MAL (ilegible):
"Los huéspedes alojados son María García en habitación 101 que es una Suite en piso 1 con checkout 2026-03-20 y Carlos López en habitación 205..."

BIEN (resumen con datos clave):
"La reserva de **María García**:
- **Habitación**: 101 (Suite)
- **Estadía**: 10/03 → 20/03 (10 noches)
- **Estado**: Alojada
- **Total**: **$150.000** — Pagado: $100.000, Pendiente: **$50.000**"

14. **Formato de fechas y estados**: Convertí los valores técnicos a lenguaje natural:
  - Fechas: "20/03" o "20 de marzo" en vez de "2026-03-20"
  - Estados: "alojado/a" en vez de CHECKED_IN, "confirmada" en vez de CONFIRMED, "pendiente" en vez de PENDING, "cancelada" en vez de CANCELLED
  - Montos: siempre con $ y separador de miles (ej: **$45.000**)
  - NUNCA muestres UUIDs al usuario a menos que los pida explícitamente

15. **Proactividad inteligente**: Cuando respondas sobre un huésped o reserva, agregá información útil adicional:
  - Si el huésped tiene 5+ visitas, mencioná que es **VIP** y su historial
  - Si hay un balance pendiente, alertá al respecto
  - Si hay habitaciones sucias y check-ins programados, advertí sobre posibles cuellos de botella
  - Si la ocupación es baja, sugirí activar promociones o contactar huéspedes frecuentes

16. **Modo briefing**: Cuando el mensaje empiece con "[BRIEFING]" o "[INSIGHTS]", actuá como analista de datos del hotel. Sé conciso, usá datos reales del snapshot, y enfocate en lo accionable. NO preguntes, solo analizá y respondé.
`;

// ─── Build role-specific prompt section ──────────────────────────────────

function buildRolePrompt(role: UserRole, permissions: RolePermissions): string {
  const queryDocs: Record<string, string> = {
    search_guest:
      "[QUERY:search_guest:nombre] — Buscar huésped por nombre",
    check_availability:
      "[QUERY:check_availability:YYYY-MM-DD:YYYY-MM-DD] — Ver disponibilidad entre fechas",
    get_booking:
      "[QUERY:get_booking:id] — Detalle completo de una reserva",
    get_room_status:
      "[QUERY:get_room_status] — Estado actual de todas las habitaciones",
    get_payments:
      "[QUERY:get_payments:booking_id] — Pagos de una reserva específica",
    get_expenses:
      "[QUERY:get_expenses:YYYY-MM] — Gastos de un mes",
    get_rates:
      "[QUERY:get_rates] — Tarifas y promociones vigentes",
    get_guest_bookings:
      "[QUERY:get_guest_bookings:nombre_o_id] — Historial de reservas de un huésped (acepta nombre o ID)",
    get_current_guests:
      "[QUERY:get_current_guests] — Lista de huéspedes alojados en este momento con datos completos",
  };

  const actionDocs: Record<string, string> = {
    create_booking:
      '[ACTION:create_booking:{"guest_id":"...","room_id":"...","check_in_date":"YYYY-MM-DD","check_out_date":"YYYY-MM-DD","adults":N,"children":N,"total_amount":N}]',
    update_booking_status:
      '[ACTION:update_booking_status:{"id":"...","status":"CONFIRMED|CHECKED_IN|CHECKED_OUT|CANCELLED"}]',
    create_payment:
      '[ACTION:create_payment:{"booking_id":"...","amount":N,"method":"CASH|CARD|TRANSFER"}]',
    create_housekeeping:
      '[ACTION:create_housekeeping:{"room_id":"...","priority":"LOW|NORMAL|URGENT|CHECKOUT","notes":"..."}]',
  };

  let prompt = `\n## USUARIO ACTUAL\n- Rol: ${permissions.label}\n`;

  // Role-specific instructions
  if (role === "housekeeping") {
    prompt += `- Este usuario SOLO puede ver el estado de habitaciones y gestionar tareas de limpieza.
- NO tiene acceso a reservas, huéspedes, pagos, gastos, tarifas ni facturación.
- Si pide información sobre reservas, finanzas o huéspedes, indicale que no tiene permisos y que consulte con recepción o administración.\n`;
  } else if (role === "reception") {
    prompt += `- Tiene acceso a reservas, huéspedes, habitaciones, pagos y tarifas.
- NO tiene acceso a gastos ni estadísticas financieras avanzadas.
- Puede crear reservas, registrar pagos, hacer check-in/out y buscar huéspedes.
- Si pide información sobre gastos o reportes financieros, indicale que no tiene permisos y que consulte con administración.\n`;
  } else if (role === "auditor") {
    prompt += `- Tiene acceso de SOLO LECTURA a toda la información del hotel.
- NO puede ejecutar ninguna acción de escritura (crear reservas, pagos, etc.).
- Si pide realizar una acción, indicale que su rol es de solo lectura/auditoría y que contacte a recepción o administración para ejecutar cambios.\n`;
  } else {
    prompt += `- Acceso completo a todas las funciones del sistema.\n`;
  }

  // Available queries
  const allowedQueryDocs = permissions.allowedQueries
    .map((q) => queryDocs[q])
    .filter(Boolean);
  if (allowedQueryDocs.length > 0) {
    prompt += `\n## COMANDOS DE CONSULTA DISPONIBLES\nCuando necesites datos específicos, incluí estos tags en tu respuesta:\n${allowedQueryDocs.map((d) => `- ${d}`).join("\n")}\n`;
  }

  // Available actions
  const allowedActionDocs = permissions.allowedActions
    .map((a) => actionDocs[a])
    .filter(Boolean);
  if (allowedActionDocs.length > 0) {
    prompt += `\n## COMANDOS DE ACCIÓN DISPONIBLES\n${allowedActionDocs.map((d) => `- ${d}`).join("\n")}\n`;
  } else {
    prompt += `\n## ACCIONES\nEste usuario NO tiene permisos para ejecutar acciones de escritura. No incluyas tags [ACTION] en tus respuestas.\n`;
  }

  return prompt;
}

// ─── Helper: Get user role from JWT ──────────────────────────────────────

async function getUserRole(
  supabase: any,
  authHeader: string | null
): Promise<{ role: UserRole; userName: string | null; userId: string | null }> {
  const defaultResult = {
    role: "reception" as UserRole,
    userName: null,
    userId: null,
  };

  if (!authHeader) return defaultResult;

  try {
    // Extract Bearer token
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token.length < 10) return defaultResult;

    // Decode JWT payload to get user ID (base64url decode)
    const parts = token.split(".");
    if (parts.length !== 3) return defaultResult;

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const userId = payload.sub;
    if (!userId) return defaultResult;

    // Query profiles table for role
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", userId)
      .single();

    if (error || !profile) {
      // Fallback: check user_metadata
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const metaRole = userData?.user?.user_metadata?.role as UserRole;
      return {
        role: metaRole || "reception",
        userName: userData?.user?.user_metadata?.full_name || null,
        userId,
      };
    }

    return {
      role: (profile.role as UserRole) || "reception",
      userName: profile.full_name || null,
      userId,
    };
  } catch (err) {
    console.error("Error getting user role:", err);
    return defaultResult;
  }
}

// ─── Helper: Build hotel snapshot (role-filtered) ────────────────────────

async function getHotelSnapshot(
  supabase: any,
  sections: string[]
): Promise<string> {
  const today = new Date().toISOString().split("T")[0];
  const parts: string[] = [`📊 SNAPSHOT DEL HOTEL — ${today}`];

  // Always fetch rooms (needed for multiple sections)
  const roomsRes = await supabase
    .from("rooms")
    .select("id, room_number, floor, status, room_type_id");
  const rooms = roomsRes.data || [];

  // Occupancy section
  if (sections.includes("occupancy")) {
    const totalRooms = rooms.length;
    const available = rooms.filter(
      (r: any) => r.status === "AVAILABLE"
    ).length;
    const occupied = rooms.filter(
      (r: any) => r.status === "OCCUPIED"
    ).length;
    const dirty = rooms.filter((r: any) => r.status === "DIRTY").length;
    const maintenance = rooms.filter(
      (r: any) =>
        r.status === "MAINTENANCE" || r.status === "OUT_OF_ORDER"
    ).length;
    const occupancyRate =
      totalRooms > 0 ? ((occupied / totalRooms) * 100).toFixed(1) : "0";

    parts.push(`
🏨 OCUPACIÓN:
- Total habitaciones: ${totalRooms}
- Disponibles: ${available} | Ocupadas: ${occupied} | Sucias: ${dirty} | Mantenimiento: ${maintenance}
- Tasa de ocupación: ${occupancyRate}%`);
  }

  // Bookings data (needed for today + bookings + recent sections)
  let bookings: any[] = [];
  let guestsMap: Record<string, string> = {};

  if (
    sections.includes("today") ||
    sections.includes("bookings") ||
    sections.includes("recent") ||
    sections.includes("current_guests")
  ) {
    const bookingsRes = await supabase
      .from("bookings")
      .select(
        "id, guest_id, room_id, check_in_date, check_out_date, adults, children, status, total_amount, has_vehicle, vehicle_description, license_plate, notes"
      )
      .in("status", ["CONFIRMED", "CHECKED_IN", "PENDING"]);
    bookings = bookingsRes.data || [];

    // Get guest names
    const guestIds = [
      ...new Set(bookings.map((b: any) => b.guest_id).filter(Boolean)),
    ];
    if (guestIds.length > 0) {
      const guestsRes = await supabase
        .from("guests")
        .select("id, full_name")
        .in("id", guestIds);
      (guestsRes.data || []).forEach((g: any) => {
        guestsMap[g.id] = g.full_name;
      });
    }
  }

  // Current guests section — who is CHECKED IN right now
  if (sections.includes("current_guests")) {
    const currentGuestBookings = bookings.filter(
      (b: any) =>
        b.status === "CHECKED_IN" &&
        b.check_in_date?.split("T")[0] <= today &&
        b.check_out_date?.split("T")[0] > today
    );

    // Fetch full guest details for current guests
    const currentGuestIds = [
      ...new Set(currentGuestBookings.map((b: any) => b.guest_id).filter(Boolean)),
    ];
    let currentGuestsDetails: Record<string, any> = {};
    if (currentGuestIds.length > 0) {
      const cgRes = await supabase
        .from("guests")
        .select("id, full_name, email, phone, country")
        .in("id", currentGuestIds);
      (cgRes.data || []).forEach((g: any) => {
        currentGuestsDetails[g.id] = g;
      });
    }

    // Fetch room type names
    const rtRes = await supabase.from("room_types").select("id, name");
    const roomTypesMap: Record<string, string> = {};
    (rtRes.data || []).forEach((t: any) => {
      roomTypesMap[t.id] = t.name;
    });

    const currentGuestsList = currentGuestBookings
      .map((b: any, i: number) => {
        const guest = currentGuestsDetails[b.guest_id];
        const room = rooms.find((r: any) => r.id === b.room_id);
        const roomType = room ? roomTypesMap[room.room_type_id] || "?" : "?";
        const lines = [
          `[Huésped ${i + 1}]`,
          `  Nombre: ${guest?.full_name || "Desconocido"}`,
          `  Habitación: ${room?.room_number || "?"} (${roomType}, Piso ${room?.floor || "?"})`,
          `  Estadía: ${b.check_in_date?.split("T")[0]} → ${b.check_out_date?.split("T")[0]}`,
          `  Huéspedes: ${b.adults} adultos, ${b.children} niños`,
        ];
        if (guest?.email) lines.push(`  Email: ${guest.email}`);
        if (guest?.phone) lines.push(`  Tel: ${guest.phone}`);
        if (guest?.country) lines.push(`  País: ${guest.country}`);
        if (b.has_vehicle) lines.push(`  Vehículo: ${b.vehicle_description || "Sí"} (${b.license_plate || "sin patente"})`);
        if (b.notes) lines.push(`  Notas: ${b.notes}`);
        return lines.join("\n");
      })
      .join("\n\n");

    parts.push(`
🏠 HUÉSPEDES ALOJADOS ACTUALMENTE (${currentGuestBookings.length}):
${currentGuestsList || "(ningún huésped alojado en este momento)"}`);
  }

  // Today section — with guest names
  if (sections.includes("today")) {
    const checkInsTodayList = bookings.filter(
      (b: any) =>
        b.check_in_date?.split("T")[0] === today &&
        (b.status === "CONFIRMED" || b.status === "CHECKED_IN")
    );
    const checkOutsTodayList = bookings.filter(
      (b: any) =>
        b.check_out_date?.split("T")[0] === today && b.status === "CHECKED_IN"
    );

    const formatTodayEntry = (b: any) => {
      const room = rooms.find((r: any) => r.id === b.room_id);
      const statusLabel: Record<string, string> = { CONFIRMED: "confirmada", CHECKED_IN: "alojado", PENDING: "pendiente" };
      return `  - ${guestsMap[b.guest_id] || "Desconocido"} — Hab ${room?.room_number || "?"} (${statusLabel[b.status] || b.status})`;
    };

    parts.push(`
📅 HOY:
- Check-ins programados (${checkInsTodayList.length}):
${checkInsTodayList.map(formatTodayEntry).join("\n") || "  (ninguno)"}
- Check-outs programados (${checkOutsTodayList.length}):
${checkOutsTodayList.map(formatTodayEntry).join("\n") || "  (ninguno)"}`);
  }

  // Room types section
  if (sections.includes("room_types")) {
    const typesRes = await supabase
      .from("room_types")
      .select("id, name, base_price, max_guests");
    const types = typesRes.data || [];
    const roomTypesList = types
      .map(
        (t: any) =>
          `- ${t.name}: $${t.base_price}/noche (máx ${t.max_guests} huéspedes)`
      )
      .join("\n");
    parts.push(`
🛏️ TIPOS DE HABITACIÓN:
${roomTypesList || "(sin datos)"}`);
  }

  // Bookings section — split into 3 clear categories
  if (sections.includes("bookings")) {
    const statusLabels: Record<string, string> = {
      CONFIRMED: "confirmada", CHECKED_IN: "alojado", PENDING: "pendiente",
      CHECKED_OUT: "salió", CANCELLED: "cancelada", NO_SHOW: "no-show",
    };
    const formatBooking = (b: any) => {
      const room = rooms.find((r: any) => r.id === b.room_id);
      const lines = [
        `- ${guestsMap[b.guest_id] || "Desconocido"} — Hab ${room?.room_number || "?"}`,
        `  Estadía: ${b.check_in_date?.split("T")[0]} → ${b.check_out_date?.split("T")[0]}`,
        `  Estado: ${statusLabels[b.status] || b.status} — Total: $${b.total_amount}`,
      ];
      if (b.has_vehicle) lines.push(`  Vehículo: ${b.vehicle_description || "Sí"} (${b.license_plate || "sin patente"})`);
      return lines.join("\n");
    };

    // Category 1: Currently checked in (staying tonight)
    const checkedInNow = bookings.filter(
      (b: any) =>
        b.status === "CHECKED_IN" &&
        b.check_in_date?.split("T")[0] <= today &&
        b.check_out_date?.split("T")[0] > today
    );

    // Category 2: Arriving today (confirmed/pending, check_in is today)
    const arrivingToday = bookings.filter(
      (b: any) =>
        b.check_in_date?.split("T")[0] === today &&
        (b.status === "CONFIRMED" || b.status === "PENDING")
    );

    // Category 3: Future reservations (check_in > today)
    const futureBookings = bookings.filter(
      (b: any) =>
        b.check_in_date?.split("T")[0] > today &&
        (b.status === "CONFIRMED" || b.status === "PENDING")
    );

    parts.push(`
📋 RESERVAS — ALOJADOS AHORA (${checkedInNow.length}):
${checkedInNow.map(formatBooking).join("\n") || "(ninguno)"}

📋 RESERVAS — LLEGADAS PENDIENTES HOY (${arrivingToday.length}):
${arrivingToday.map(formatBooking).join("\n") || "(ninguna)"}

📋 RESERVAS — FUTURAS (${futureBookings.length}):
${futureBookings.map(formatBooking).join("\n") || "(ninguna)"}`);
  }

  // Recent bookings section
  if (sections.includes("recent")) {
    const recentRes = await supabase
      .from("bookings")
      .select(
        "id, guest_id, room_id, check_in_date, check_out_date, status, total_amount, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(5);
    const recent = recentRes.data || [];

    const recentStatusLabels: Record<string, string> = {
      CONFIRMED: "confirmada", CHECKED_IN: "alojado", PENDING: "pendiente",
      CHECKED_OUT: "salió", CANCELLED: "cancelada", NO_SHOW: "no-show",
    };
    const recentBookings = recent
      .map((b: any) => {
        const room = rooms.find((r: any) => r.id === b.room_id);
        return `- Hab ${room?.room_number || "?"} — ${recentStatusLabels[b.status] || b.status} — $${b.total_amount} (creada: ${b.created_at?.split("T")[0]})`;
      })
      .join("\n");

    parts.push(`
🆕 ÚLTIMAS 5 RESERVAS:
${recentBookings || "(ninguna)"}`);
  }

  // Housekeeping section
  if (sections.includes("housekeeping")) {
    const tasksRes = await supabase
      .from("housekeeping_tasks")
      .select("id, room_id, status, priority, notes")
      .eq("date", today)
      .neq("status", "DONE");
    const tasks = tasksRes.data || [];

    const pendingTasks = tasks
      .map((t: any) => {
        const room = rooms.find((r: any) => r.id === t.room_id);
        return `- Hab ${room?.room_number || "?"} | ${t.priority} | ${t.status}${t.notes ? ` | ${t.notes}` : ""}`;
      })
      .join("\n");

    // For housekeeping, also list dirty rooms
    const dirtyRooms = rooms.filter((r: any) => r.status === "DIRTY");
    const dirtyList = dirtyRooms
      .map((r: any) => `- Hab ${r.room_number} (Piso ${r.floor})`)
      .join("\n");

    parts.push(`
🧹 TAREAS DE LIMPIEZA PENDIENTES HOY:
${pendingTasks || "(ninguna pendiente)"}

🔴 HABITACIONES SUCIAS (${dirtyRooms.length}):
${dirtyList || "(ninguna)"}`);
  }

  return parts.join("\n").trim();
}

// ─── Helper: Execute query commands ──────────────────────────────────────

async function executeQuery(
  supabase: any,
  type: string,
  params: string
): Promise<string> {
  try {
    switch (type) {
      case "search_guest": {
        // First try exact substring match
        const { data } = await supabase
          .from("guests")
          .select("*")
          .ilike("full_name", `%${params}%`)
          .limit(10);

        if (data?.length) {
          return (
            `Huéspedes encontrados (${data.length}):\n` +
            data
              .map(
                (g: any, i: number) => {
                  const lines = [`[Huésped ${i + 1}]`, `  Nombre: ${g.full_name}`];
                  if (g.email) lines.push(`  Email: ${g.email}`);
                  if (g.phone) lines.push(`  Tel: ${g.phone}`);
                  if (g.country) lines.push(`  País: ${g.country}`);
                  lines.push(`  ID: ${g.id}`);
                  return lines.join("\n");
                }
              )
              .join("\n\n")
          );
        }

        // No exact match — try fuzzy: search by each word individually
        const words = params.trim().split(/\s+/).filter((w: string) => w.length >= 3);
        const fuzzyResults: any[] = [];
        const seenIds = new Set<string>();

        for (const word of words) {
          const { data: partial } = await supabase
            .from("guests")
            .select("*")
            .ilike("full_name", `%${word}%`)
            .limit(10);
          if (partial) {
            for (const g of partial) {
              if (!seenIds.has(g.id)) {
                seenIds.add(g.id);
                fuzzyResults.push(g);
              }
            }
          }
        }

        // Also try with soundex-like: first 3 chars of each word
        if (fuzzyResults.length === 0) {
          for (const word of words) {
            if (word.length >= 3) {
              const prefix = word.substring(0, 3);
              const { data: prefixMatch } = await supabase
                .from("guests")
                .select("*")
                .ilike("full_name", `%${prefix}%`)
                .limit(15);
              if (prefixMatch) {
                for (const g of prefixMatch) {
                  if (!seenIds.has(g.id)) {
                    seenIds.add(g.id);
                    fuzzyResults.push(g);
                  }
                }
              }
            }
          }
        }

        if (fuzzyResults.length > 0) {
          return (
            `No se encontró un huésped con el nombre exacto "${params}", pero se encontraron estos nombres similares (quizás quisiste decir alguno de ellos):\n` +
            fuzzyResults.slice(0, 8).map(
              (g: any, i: number) => {
                const lines = [`[Sugerencia ${i + 1}]`, `  Nombre: ${g.full_name}`];
                if (g.email) lines.push(`  Email: ${g.email}`);
                if (g.phone) lines.push(`  Tel: ${g.phone}`);
                lines.push(`  ID: ${g.id}`);
                return lines.join("\n");
              }
            ).join("\n\n")
          );
        }

        return `No se encontraron huéspedes con el nombre "${params}" ni nombres similares.`;
      }
      case "check_availability": {
        const [checkIn, checkOut] = params.split(":");
        const { data: busyBookings } = await supabase
          .from("bookings")
          .select("room_id")
          .lt("check_in_date", checkOut)
          .gt("check_out_date", checkIn)
          .in("status", ["CONFIRMED", "CHECKED_IN", "PENDING"]);
        const busyRoomIds = (busyBookings || []).map(
          (b: any) => b.room_id
        );
        const { data: allRooms } = await supabase
          .from("rooms")
          .select("id, room_number, floor, status, room_type_id")
          .in("status", ["AVAILABLE", "DIRTY"]);
        const { data: types } = await supabase
          .from("room_types")
          .select("id, name, base_price");
        const typesMap: Record<string, any> = {};
        (types || []).forEach((t: any) => {
          typesMap[t.id] = t;
        });
        const availableRooms = (allRooms || []).filter(
          (r: any) => !busyRoomIds.includes(r.id)
        );
        if (!availableRooms.length)
          return `No hay habitaciones disponibles entre ${checkIn} y ${checkOut}.`;
        return (
          `Habitaciones disponibles (${checkIn} → ${checkOut}): ${availableRooms.length}\n` +
          availableRooms
            .map((r: any) => {
              const t = typesMap[r.room_type_id];
              return `- Hab ${r.room_number} (Piso ${r.floor})\n  Tipo: ${t?.name || "?"} — $${t?.base_price || "?"}/noche\n  Estado actual: ${r.status}`;
            })
            .join("\n\n")
        );
      }
      case "get_booking": {
        const { data: booking } = await supabase
          .from("bookings")
          .select("*")
          .eq("id", params)
          .single();
        if (!booking)
          return `No se encontró la reserva con ID ${params}.`;
        const { data: guest } = await supabase
          .from("guests")
          .select("*")
          .eq("id", booking.guest_id)
          .single();
        const { data: room } = await supabase
          .from("rooms")
          .select("*, room_types(name, base_price)")
          .eq("id", booking.room_id)
          .single();
        const { data: payments } = await supabase
          .from("payments")
          .select("*")
          .eq("booking_id", booking.id);
        const totalPaid = (payments || [])
          .filter((p: any) => p.status === "PAID")
          .reduce((s: number, p: any) => s + p.amount, 0);
        const bStatusLabels: Record<string, string> = {
          CONFIRMED: "confirmada", CHECKED_IN: "alojado/a", PENDING: "pendiente",
          CHECKED_OUT: "check-out realizado", CANCELLED: "cancelada", NO_SHOW: "no-show",
        };
        const lines = [
          `Detalle de reserva:`,
          `  Huésped: ${guest?.full_name || "Desconocido"}`,
        ];
        if (guest?.email) lines.push(`  Email: ${guest.email}`);
        lines.push(
          `  Habitación: ${room?.room_number || "?"} (${room?.room_types?.name || "?"})`,
          `  Estadía: ${booking.check_in_date?.split("T")[0]} → ${booking.check_out_date?.split("T")[0]}`,
          `  Huéspedes: ${booking.adults} adultos, ${booking.children} niños`,
          `  Estado: ${bStatusLabels[booking.status] || booking.status}`,
          `  Total: $${booking.total_amount}`,
          `  Pagado: $${totalPaid} — Pendiente: $${booking.total_amount - totalPaid}`,
        );
        if (booking.has_vehicle) {
          lines.push(`  Vehículo: ${booking.vehicle_description || "Sí"} (${booking.license_plate || "sin patente"})`);
        }
        if (booking.notes) lines.push(`  Notas: ${booking.notes}`);
        return lines.join("\n");
      }
      case "get_room_status": {
        const { data: statusRooms } = await supabase
          .from("rooms")
          .select("room_number, floor, status, room_type_id")
          .order("room_number");
        const { data: types } = await supabase
          .from("room_types")
          .select("id, name");
        const typesMap: Record<string, string> = {};
        (types || []).forEach((t: any) => {
          typesMap[t.id] = t.name;
        });
        const roomStatusLabels: Record<string, string> = {
          AVAILABLE: "disponible", OCCUPIED: "ocupada", DIRTY: "sucia",
          MAINTENANCE: "mantenimiento", OUT_OF_ORDER: "fuera de servicio",
        };
        return (
          `Estado de habitaciones (${(statusRooms || []).length}):\n` +
          (statusRooms || [])
            .map(
              (r: any) =>
                `- Hab ${r.room_number} (Piso ${r.floor}) — ${typesMap[r.room_type_id] || "?"} — ${roomStatusLabels[r.status] || r.status}`
            )
            .join("\n")
        );
      }
      case "get_payments": {
        const { data } = await supabase
          .from("payments")
          .select("*")
          .eq("booking_id", params)
          .order("date", { ascending: false });
        if (!data?.length)
          return `No hay pagos registrados para la reserva ${params.slice(0, 8)}.`;
        const payMethodLabels: Record<string, string> = {
          CASH: "efectivo", CARD: "tarjeta", TRANSFER: "transferencia", OTHER: "otro",
        };
        const payStatusLabels: Record<string, string> = {
          PAID: "pagado", PENDING: "pendiente", FAILED: "fallido", REFUNDED: "reembolsado",
        };
        const totalPaidAmt = data.filter((p: any) => p.status === "PAID").reduce((s: number, p: any) => s + Number(p.amount), 0);
        return (
          `Pagos de la reserva (Total pagado: $${totalPaidAmt}):\n` +
          data
            .map(
              (p: any) =>
                `- $${p.amount} — ${payMethodLabels[p.method] || p.method} — ${payStatusLabels[p.status] || p.status} (${p.date?.split("T")[0]})${p.comment ? `\n  Comentario: ${p.comment}` : ""}`
            )
            .join("\n")
        );
      }
      case "get_expenses": {
        const monthStart = `${params}-01`;
        const [y, m] = params.split("-").map(Number);
        const nextMonth =
          m === 12
            ? `${y + 1}-01-01`
            : `${y}-${String(m + 1).padStart(2, "0")}-01`;
        const { data } = await supabase
          .from("expenses")
          .select("*")
          .gte("date", monthStart)
          .lt("date", nextMonth)
          .order("date", { ascending: false });
        if (!data?.length) return `No hay gastos registrados en ${params}.`;
        const total = data.reduce((s: number, e: any) => s + e.amount, 0);
        return (
          `Gastos de ${params} — Total: $${total} (${data.length} registros):\n` +
          data
            .map(
              (e: any) =>
                `- ${e.date?.split("T")[0]} — ${e.expense_type} — $${e.amount}${e.description ? `\n  Detalle: ${e.description}` : ""}`
            )
            .join("\n")
        );
      }
      case "get_rates": {
        const { data } = await supabase
          .from("rates")
          .select("*, room_types(name)")
          .eq("is_active", true)
          .order("start_date");
        if (!data?.length) return "No hay tarifas activas.";
        return (
          `Tarifas vigentes (${data.length}):\n` +
          data
            .map(
              (r: any) => {
                const lines = [
                  `- ${r.label} — ${r.room_types?.name || "Todas las habitaciones"}`,
                  `  Precio: $${r.price}/noche — Vigencia: ${r.start_date?.split("T")[0]} → ${r.end_date?.split("T")[0]}`,
                ];
                if (r.discount_percent) lines.push(`  Descuento: ${r.discount_percent}%`);
                if (r.promo_code) lines.push(`  Código promo: ${r.promo_code}`);
                if (r.min_nights) lines.push(`  Mínimo: ${r.min_nights} noches`);
                return lines.join("\n");
              }
            )
            .join("\n\n")
        );
      }
      case "get_guest_bookings": {
        // Detect if params is a UUID or a name
        const isUUID =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            params
          );

        let guestId = params;
        let guestName = "";

        if (!isUUID) {
          // Search for guest by name first (exact substring)
          const { data: matchingGuests } = await supabase
            .from("guests")
            .select("id, full_name")
            .ilike("full_name", `%${params}%`)
            .limit(5);

          if (!matchingGuests?.length) {
            // Fuzzy fallback: search by each word individually
            const words = params.trim().split(/\s+/).filter((w: string) => w.length >= 3);
            const fuzzyGuests: any[] = [];
            const seenIds = new Set<string>();

            for (const word of words) {
              const { data: partial } = await supabase
                .from("guests")
                .select("id, full_name")
                .ilike("full_name", `%${word}%`)
                .limit(10);
              if (partial) {
                for (const g of partial) {
                  if (!seenIds.has(g.id)) {
                    seenIds.add(g.id);
                    fuzzyGuests.push(g);
                  }
                }
              }
            }

            // Also try prefix matching (first 3 chars of each word)
            if (fuzzyGuests.length === 0) {
              for (const word of words) {
                if (word.length >= 3) {
                  const prefix = word.substring(0, 3);
                  const { data: prefixMatch } = await supabase
                    .from("guests")
                    .select("id, full_name")
                    .ilike("full_name", `%${prefix}%`)
                    .limit(10);
                  if (prefixMatch) {
                    for (const g of prefixMatch) {
                      if (!seenIds.has(g.id)) {
                        seenIds.add(g.id);
                        fuzzyGuests.push(g);
                      }
                    }
                  }
                }
              }
            }

            if (fuzzyGuests.length > 0) {
              return (
                `No se encontró ningún huésped con el nombre "${params}", pero quizás quisiste decir:\n` +
                fuzzyGuests.slice(0, 8).map((g: any) => `- ${g.full_name} (ID: ${g.id})`).join("\n") +
                `\n\nDecime cuál es y te busco sus reservas.`
              );
            }

            return `No se encontró ningún huésped con el nombre "${params}" ni nombres similares.`;
          }

          if (matchingGuests.length > 1) {
            return (
              `Se encontraron varios huéspedes con ese nombre. Especificá cuál:\n` +
              matchingGuests
                .map((g: any) => `- ${g.full_name} (ID: ${g.id})`)
                .join("\n")
            );
          }

          guestId = matchingGuests[0].id;
          guestName = matchingGuests[0].full_name;
        }

        const { data } = await supabase
          .from("bookings")
          .select(
            "id, room_id, check_in_date, check_out_date, status, total_amount, rooms(room_number)"
          )
          .eq("guest_id", guestId)
          .order("check_in_date", { ascending: false })
          .limit(10);
        if (!data?.length)
          return `No hay reservas para ${guestName || "este huésped"}.`;
        const gbStatusLabels: Record<string, string> = {
          CONFIRMED: "confirmada", CHECKED_IN: "alojado/a", PENDING: "pendiente",
          CHECKED_OUT: "check-out", CANCELLED: "cancelada", NO_SHOW: "no-show",
        };
        return (
          `Historial de reservas de ${guestName || "este huésped"} (${data.length}):\n` +
          data
            .map(
              (b: any) =>
                `- Hab ${b.rooms?.room_number || "?"} — ${b.check_in_date?.split("T")[0]} → ${b.check_out_date?.split("T")[0]}\n  Estado: ${gbStatusLabels[b.status] || b.status} — Total: $${b.total_amount}`
            )
            .join("\n\n")
        );
      }
      case "get_current_guests": {
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: currentBookings } = await supabase
          .from("bookings")
          .select(
            "id, guest_id, room_id, check_in_date, check_out_date, adults, children, status, total_amount, has_vehicle, vehicle_description, license_plate, notes"
          )
          .eq("status", "CHECKED_IN")
          .lte("check_in_date", todayStr)
          .gt("check_out_date", todayStr);

        if (!currentBookings?.length)
          return "No hay huéspedes alojados en este momento.";

        // Fetch guest details
        const cgIds = [
          ...new Set(
            currentBookings.map((b: any) => b.guest_id).filter(Boolean)
          ),
        ];
        const { data: cgGuests } = await supabase
          .from("guests")
          .select("id, full_name, email, phone, country, document_id")
          .in("id", cgIds);
        const cgMap: Record<string, any> = {};
        (cgGuests || []).forEach((g: any) => {
          cgMap[g.id] = g;
        });

        // Fetch room details
        const crIds = [
          ...new Set(
            currentBookings.map((b: any) => b.room_id).filter(Boolean)
          ),
        ];
        const { data: cgRooms } = await supabase
          .from("rooms")
          .select("id, room_number, floor, room_type_id, room_types(name)")
          .in("id", crIds);
        const crMap: Record<string, any> = {};
        (cgRooms || []).forEach((r: any) => {
          crMap[r.id] = r;
        });

        return (
          `Huéspedes alojados actualmente (${currentBookings.length}):\n\n` +
          currentBookings
            .map((b: any, i: number) => {
              const g = cgMap[b.guest_id];
              const r = crMap[b.room_id];
              const lines = [
                `[Huésped ${i + 1}]`,
                `  Nombre: ${g?.full_name || "Desconocido"}`,
                `  Habitación: ${r?.room_number || "?"} (${r?.room_types?.name || "?"}, Piso ${r?.floor || "?"})`,
                `  Estadía: ${b.check_in_date?.split("T")[0]} → ${b.check_out_date?.split("T")[0]}`,
                `  Huéspedes: ${b.adults} adultos, ${b.children} niños`,
              ];
              if (g?.email) lines.push(`  Email: ${g.email}`);
              if (g?.phone) lines.push(`  Tel: ${g.phone}`);
              if (g?.country) lines.push(`  País: ${g.country}`);
              if (g?.document_id) lines.push(`  Documento: ${g.document_id}`);
              if (b.has_vehicle) lines.push(`  Vehículo: ${b.vehicle_description || "Sí"} (${b.license_plate || "sin patente"})`);
              if (b.notes) lines.push(`  Notas: ${b.notes}`);
              return lines.join("\n");
            })
            .join("\n\n")
        );
      }
      default:
        return `Consulta no reconocida: ${type}`;
    }
  } catch (err) {
    return `Error ejecutando consulta ${type}: ${err instanceof Error ? err.message : "desconocido"}`;
  }
}

// ─── Helper: Execute action commands ─────────────────────────────────────

async function executeAction(
  supabase: any,
  type: string,
  paramsJson: string
): Promise<string> {
  try {
    const params = JSON.parse(paramsJson);
    switch (type) {
      case "create_booking": {
        // Validate availability before creating
        const { data: isAvailable, error: availErr } = await supabase.rpc(
          "check_room_availability",
          {
            p_room_id: params.room_id,
            p_check_in: params.check_in_date,
            p_check_out: params.check_out_date,
          }
        );
        if (availErr)
          return `Error al verificar disponibilidad: ${availErr.message}`;
        if (!isAvailable)
          return `⚠️ La habitación ya tiene una reserva activa en esas fechas (${params.check_in_date} a ${params.check_out_date}). Elegí otras fechas u otra habitación.`;

        const { data, error } = await supabase
          .from("bookings")
          .insert({
            guest_id: params.guest_id,
            room_id: params.room_id,
            check_in_date: params.check_in_date,
            check_out_date: params.check_out_date,
            adults: params.adults || 1,
            children: params.children || 0,
            status: "CONFIRMED",
            total_amount: params.total_amount || 0,
            notes: params.notes || null,
            has_vehicle: params.has_vehicle || false,
            vehicle_description: params.vehicle_description || null,
            license_plate: params.license_plate || null,
          })
          .select()
          .single();
        if (error)
          return `Error al crear reserva: ${error.message}`;
        return `✅ Reserva creada exitosamente (ID: ${data.id.slice(0, 8)}). Estado: CONFIRMED, total: $${data.total_amount}.`;
      }
      case "update_booking_status": {
        const { data, error } = await supabase
          .from("bookings")
          .update({ status: params.status })
          .eq("id", params.id)
          .select()
          .single();
        if (error)
          return `Error al actualizar estado: ${error.message}`;
        if (
          params.status === "CHECKED_OUT" ||
          params.status === "CANCELLED"
        ) {
          await supabase
            .from("rooms")
            .update({ status: "DIRTY" })
            .eq("id", data.room_id);
        } else if (params.status === "CHECKED_IN") {
          await supabase
            .from("rooms")
            .update({ status: "OCCUPIED" })
            .eq("id", data.room_id);
        }
        return `✅ Reserva #${params.id.slice(0, 8)} actualizada a estado: ${params.status}.`;
      }
      case "create_payment": {
        const { data, error } = await supabase
          .from("payments")
          .insert({
            booking_id: params.booking_id,
            amount: params.amount,
            method: params.method || "CASH",
            status: "PAID",
            date: new Date().toISOString(),
            comment: params.comment || null,
          })
          .select()
          .single();
        if (error)
          return `Error al registrar pago: ${error.message}`;
        return `✅ Pago registrado: $${data.amount} (${data.method}) para reserva #${params.booking_id.slice(0, 8)}.`;
      }
      case "create_housekeeping": {
        const { data, error } = await supabase
          .from("housekeeping_tasks")
          .insert({
            room_id: params.room_id,
            date: new Date().toISOString().split("T")[0],
            priority: params.priority || "NORMAL",
            status: "TODO",
            notes: params.notes || null,
          })
          .select()
          .single();
        if (error)
          return `Error al crear tarea: ${error.message}`;
        return `✅ Tarea de limpieza creada para la habitación (prioridad: ${data.priority}).`;
      }
      default:
        return `Acción no reconocida: ${type}`;
    }
  } catch (err) {
    return `Error ejecutando acción ${type}: ${err instanceof Error ? err.message : "JSON inválido o error desconocido"}`;
  }
}

// ─── Helper: Parse and process commands (with role filtering) ────────────

async function processCommands(
  supabase: any,
  text: string,
  permissions: RolePermissions
): Promise<{ cleanText: string; results: string[] }> {
  const results: string[] = [];
  let cleanText = text;

  // Process [QUERY:type:params] or [QUERY:type] tags (params optional)
  const queryRegex = /\[QUERY:(\w+)(?::([^\]]+))?\]/g;
  let match;
  while ((match = queryRegex.exec(text)) !== null) {
    const queryType = match[1];
    if (permissions.allowedQueries.includes(queryType)) {
      const result = await executeQuery(supabase, queryType, match[2] || "");
      results.push(result);
    } else {
      results.push(
        `⛔ Consulta "${queryType}" no permitida para tu rol. Contactá a un administrador.`
      );
    }
    cleanText = cleanText.replace(match[0], "");
  }

  // Process [ACTION:type:{json}] tags — support nested braces
  const actionRegex = /\[ACTION:(\w+):(\{[^[\]]*\})\]/g;
  while ((match = actionRegex.exec(text)) !== null) {
    const actionType = match[1];
    if (permissions.allowedActions.includes(actionType)) {
      const result = await executeAction(supabase, actionType, match[2]);
      results.push(result);
    } else {
      results.push(
        `⛔ Acción "${actionType}" no permitida para tu rol. Contactá a un administrador.`
      );
    }
    cleanText = cleanText.replace(match[0], "");
  }

  return { cleanText: cleanText.trim(), results };
}

// ─── Helper: Call OpenRouter ─────────────────────────────────────────────

async function callLLM(messages: any[]): Promise<string> {
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://home-hotel.app",
        "X-Title": "HoMe Hotel Management - Atlas Bot",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        max_tokens: 4096,
        temperature: 0.5,
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return (
    data.choices?.[0]?.message?.content ||
    "Lo siento, no pude generar una respuesta."
  );
}

/** Stream LLM response as Server-Sent Events */
function callLLMStream(messages: any[]): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const response = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://home-hotel.app",
              "X-Title": "HoMe Hotel Management - Atlas Bot",
            },
            body: JSON.stringify({
              model: OPENROUTER_MODEL,
              messages,
              max_tokens: 4096,
              temperature: 0.5,
              stream: true,
            }),
          }
        );

        if (!response.ok || !response.body) {
          const errText = await response.text();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errText })}\n\n`));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`));
              }
            } catch { /* skip malformed chunks */ }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
}

// ─── CORS headers helper ─────────────────────────────────────────────────

// 8080 es el puerto del dev server (vite.config.ts). Sin él, probar en local
// devuelve "Failed to fetch": el navegador bloquea la respuesta por CORS antes
// de entregarla, y parece un problema de API key o de la función.
const ALLOWED_ORIGINS = ["https://homeapp.com.ar", "https://www.homeapp.com.ar", "http://localhost:8080", "http://localhost:4000", "http://localhost:5173"];

function makeCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// Default static headers (overridden per-request in handler)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://homeapp.com.ar",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Main Handler ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const CORS = makeCorsHeaders(req);
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // 1. Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Get user role from JWT
    const authHeader = req.headers.get("authorization");
    const { role, userName, userId } = await getUserRole(
      supabase,
      authHeader
    );
    const permissions = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.reception;

    console.log(
      `Atlas request from user=${userId} role=${role} name=${userName}`
    );

    // 3. Parse request body
    const { message, history = [], pageContext } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Se requiere un mensaje" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...CORS },
        }
      );
    }

    // 4. Build role-specific system prompt
    const systemPrompt =
      SYSTEM_PROMPT_BASE + buildRolePrompt(role, permissions);

    // 5. Fetch role-filtered hotel snapshot
    const snapshot = await getHotelSnapshot(
      supabase,
      permissions.snapshotSections
    );

    // 6. Build messages for LLM
    const llmMessages: any[] = [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `CONTEXTO ACTUAL DEL HOTEL:\n${snapshot}`,
      },
    ];

    // Add page context if the user is on a specific page
    if (pageContext && typeof pageContext === "string") {
      llmMessages.push({
        role: "system",
        content: `CONTEXTO DE NAVEGACIÓN: El usuario ${pageContext}. Si la pregunta es ambigua, asumí que se refiere a lo que está viendo en pantalla. Si mencionan un ID de reserva o huésped, usá [QUERY:get_booking:ID] o [QUERY:search_guest:...] para obtener los datos.`,
      });
    }

    llmMessages.push(
      ...history
        .slice(-20)
        .map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    );

    // 7. First LLM call
    let llmResponse = await callLLM(llmMessages);

    // 8. Process commands with role-based filtering
    const { cleanText, results } = await processCommands(
      supabase,
      llmResponse,
      permissions
    );

    // 9. Check if client requested streaming
    const url = new URL(req.url);
    const wantStream = url.searchParams.get("stream") === "1";

    // 10. If there were commands, do a second LLM call with the results
    if (results.length > 0) {
      const secondPassMessages = [
        { role: "system", content: systemPrompt },
        {
          role: "system",
          content: `CONTEXTO ACTUAL DEL HOTEL:\n${snapshot}`,
        },
        ...history
          .slice(-20)
          .map((h: any) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
        { role: "assistant", content: llmResponse },
        {
          role: "user",
          content: `[Sistema] Se ejecutaron tus consultas/acciones. Estos son los resultados:\n\n${results.join("\n\n")}\n\nInstrucciones para tu respuesta:
1. Usá EXCLUSIVAMENTE estos datos y el snapshot. NUNCA inventes datos.
2. NO incluyas tags [QUERY] ni [ACTION].
3. Usá **negrita** para nombres, habitaciones, montos y estados.
4. Convertí estados técnicos: CHECKED_IN → "alojado/a", CONFIRMED → "confirmada", PENDING → "pendiente", CANCELLED → "cancelada", CHECKED_OUT → "salió".
5. Fechas como "20/03" (no "2026-03-20"). Montos con $ y separador de miles.
6. NUNCA muestres IDs/UUIDs al usuario.
7. Usá listas con viñetas para enumerar datos.
8. Si no encontraste la información, decilo claramente.
9. Respondé directamente sin preámbulos innecesarios.`,
        },
      ];

      if (wantStream) {
        return new Response(callLLMStream(secondPassMessages), {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
        });
      }

      llmResponse = await callLLM(secondPassMessages);
    } else {
      // No commands — stream the clean response or return directly
      if (wantStream && cleanText) {
        // Already have the text, no need to stream — send as single SSE
        const encoder = new TextEncoder();
        const body = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: cleanText })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        });
        return new Response(body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
        });
      }
      llmResponse = cleanText;
    }

    // 11. Return response (non-streaming fallback)
    return new Response(JSON.stringify({ reply: llmResponse }), {
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (error) {
    console.error("Atlas chat error:", error);
    return new Response(
      JSON.stringify({
        reply:
          "Disculpá, tuve un problema procesando tu consulta. Por favor intentá de nuevo.",
        error:
          error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      }
    );
  }
});
