/* ============================================================
   Licenciamiento (servidor): planes, limites y vigencia.

   Solo se usa en el servidor (rutas de API). Lee la suscripcion de la
   empresa y valida el consumo contra los limites del plan.

   Resiliencia: si la migracion 013 (`suscripciones_empresas`) no esta
   aplicada, NO se aplican limites (aplicada:false) para no bloquear el
   sistema. El renderer reconoce `codigo: 'PlanLimitReached'` y
   `codigo: 'PlanVencido'` para abrir el modal de upgrade.

   Nota de arquitectura: se consulta con el cliente de service_role
   (`sb`), igual que el resto de rutas, filtrando empresa_id. El RLS de
   las nuevas tablas queda como segunda capa de defensa.
   ============================================================ */

import {
  PLAN_POR_DEFECTO,
  DIAS_PRUEBA,
  PLAN_EN_PRUEBA,
  planDe,
  limiteDe,
  tieneModulo,
  multiAlmacen,
  etiquetaRecurso,
  catalogoPlanes,
} from '@/lib/planes';

const TABLA = 'suscripciones_empresas';

/* Tablas donde se cuenta el consumo de cada recurso. */
const RECURSO_TABLA = {
  productos: 'productos',
  usuarios: 'perfiles',
  proveedores: 'proveedores',
  almacenes: 'almacenes',
};

/* ------------------------------------------------------------
   Errores con `respuesta()`: `manejar()` en auth.js los detecta por
   duck-typing (no importa este modulo) y devuelve el JSON correcto.
   ------------------------------------------------------------ */

/* El limite del plan fue alcanzado. Status 403, codigo PlanLimitReached. */
export class LimitePlanError extends Error {
  constructor({ recurso, limite, uso, plan, mensaje }) {
    super(mensaje || `Alcanzaste el limite de tu plan para ${etiquetaRecurso(recurso)}.`);
    this.name = 'LimitePlanError';
    this.codigo = 'PlanLimitReached';
    this.recurso = recurso;
    this.limite = limite;
    this.uso = uso;
    this.plan = plan;
  }

  respuesta() {
    return Response.json(
      {
        ok: false,
        codigo: this.codigo,
        error: this.message,
        recurso: this.recurso,
        recurso_nombre: etiquetaRecurso(this.recurso),
        limite: this.limite,
        uso: this.uso,
        plan: this.plan,
      },
      { status: 403 }
    );
  }
}

export class ModuloNoDisponible extends Error {
  constructor({ modulo, plan, mensaje }) {
    super(mensaje || `El modulo "${modulo}" no esta incluido en tu plan actual.`);
    this.name = 'ModuloNoDisponible';
    this.codigo = 'ModuloNoDisponible';
    this.modulo = modulo;
    this.plan = plan;
  }
  respuesta() {
    return Response.json(
      {
        ok: false,
        codigo: this.codigo,
        error: this.message,
        modulo: this.modulo,
        plan: this.plan,
      },
      { status: 403 }
    );
  }
}

export class PlanVencidoError extends Error {
  constructor({ estado, plan, mensaje }) {
    super(mensaje || 'Tu plan no esta activo. Elige o renueva un plan para seguir creando registros.');
    this.name = 'PlanVencidoError';
    this.codigo = 'PlanVencido';
    this.estado = estado;
    this.plan = plan;
  }

  respuesta() {
    return Response.json(
      {
        ok: false,
        codigo: this.codigo,
        error: this.message,
        estado: this.estado,
        plan: this.plan,
      },
      { status: 402 }
    );
  }
}

/* ------------------------------------------------------------
   Lectura de la suscripcion
   ------------------------------------------------------------ */

/* Estado de la suscripcion de una empresa.

   Devuelve:
     aplicada   -> la migracion 013 existe y la empresa tiene fila
     plan       -> codigo de plan efectivo (free|basic|pro)
     estado     -> activo|trial|vencido|en_revision
     vencida    -> true si hay que bloquear operaciones de escritura
     enPrueba   -> true mientras dura el trial
     enRevision -> true si hay un pago manual pendiente de aprobacion */
export async function leerSuscripcion(sb, empresaId) {
  const { data, error } = await sb
    .from(TABLA)
    .select('plan, estado, trial_ends_at, fecha_vencimiento')
    .eq('empresa_id', empresaId)
    .maybeSingle();

  // Tabla inexistente u otro error de esquema: no aplicamos limites.
  if (error) {
    return {
      aplicada: false,
      plan: PLAN_POR_DEFECTO,
      estado: 'activo',
      trial_ends_at: null,
      fecha_vencimiento: null,
      vencida: false,
      enPrueba: false,
      enRevision: false,
      aviso: 'Falta aplicar la migracion 013 (planes y suscripciones) en la base de datos.',
    };
  }

  // Empresa sin fila (creada antes de la migracion): se trata como cuenta
  // existente SIN bloquear, para no romper el acceso de clientes actuales.
  if (!data) {
    return {
      aplicada: false,
      plan: PLAN_POR_DEFECTO,
      estado: 'activo',
      trial_ends_at: null,
      fecha_vencimiento: null,
      vencida: false,
      enPrueba: false,
      enRevision: false,
      aviso: null,
    };
  }

  const ahora = Date.now();
  const trialVencido =
    data.estado === 'trial' && data.trial_ends_at && new Date(data.trial_ends_at).getTime() < ahora;
  const pagoVencido =
    data.fecha_vencimiento && new Date(data.fecha_vencimiento).getTime() < ahora;
  const vencida = data.estado === 'vencido' || trialVencido || pagoVencido;

  return {
    aplicada: true,
    plan: planDe(data.plan).codigo,
    estado: data.estado,
    trial_ends_at: data.trial_ends_at || null,
    fecha_vencimiento: data.fecha_vencimiento || null,
    vencida,
    enPrueba: data.estado === 'trial',
    enRevision: data.estado === 'en_revision',
    aviso: null,
  };
}

/* ------------------------------------------------------------
   Consumo y validacion de limites
   ------------------------------------------------------------ */

/* Cuenta los registros activos de un recurso para la empresa. */
export async function contarUso(sb, empresaId, recurso) {
  const tabla = RECURSO_TABLA[recurso];
  if (!tabla) return 0;
  const { count } = await sb
    .from(tabla)
    .select('id', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
    .eq('activo', true);
  return count || 0;
}

/* Consumo actual de todos los recursos del plan. */
export async function consumoDe(sb, empresaId) {
  const recursos = Object.keys(RECURSO_TABLA);
  const valores = await Promise.all(
    recursos.map((r) => contarUso(sb, empresaId, r))
  );
  const uso = {};
  recursos.forEach((r, i) => { uso[r] = valores[i]; });
  return uso;
}

/* Verifica el limite del plan para un recurso ANTES de crear.

   Lanza LimitePlanError si se supera. Si la migracion no esta aplicada
   devuelve ok sin bloquear (resiliencia). */
export async function revisarLimite(sb, perfil, recurso) {
  const sus = await leerSuscripcion(sb, perfil.empresa_id);
  if (!sus.aplicada) return { ok: true, suscripcion: sus, uso: null, limite: null };

  const limite = limiteDe(sus.plan, recurso);
  if (limite === null || limite === undefined) {
    return { ok: true, suscripcion: sus, uso: null, limite: null };
  }

  const uso = await contarUso(sb, perfil.empresa_id, recurso);
  if (uso >= limite) {
    throw new LimitePlanError({
      recurso,
      limite,
      uso,
      plan: sus.plan,
      mensaje:
        `Alcanzaste el limite de ${etiquetaRecurso(recurso)} de tu plan ` +
        `${planDe(sus.plan).nombre} (${uso}/${limite}). Sube de plan para continuar.`,
    });
  }

  return { ok: true, suscripcion: sus, uso, limite };
}

/* Verifica si el plan de la empresa incluye un modulo.
   Lanza ModuloNoDisponible si no. Si la migracion no esta aplicada,
   se permite (resiliencia). */
export async function exigirModulo(sb, perfil, modulo) {
  const sus = await leerSuscripcion(sb, perfil.empresa_id);
  if (!sus.aplicada) return { ok: true, suscripcion: sus };
  if (!tieneModulo(sus.plan, modulo)) {
    throw new ModuloNoDisponible({ modulo, plan: sus.plan });
  }
  return { ok: true, suscripcion: sus };
}

export function moduloDisponible(suscripcion, modulo) {
  if (!suscripcion || !suscripcion.aplicada) return true;
  return tieneModulo(suscripcion.plan, modulo);
}
export async function exigirVigencia(sb, perfil) {
  const sus = await leerSuscripcion(sb, perfil.empresa_id);
  if (sus.aplicada && sus.vencida) {
    throw new PlanVencidoError({ estado: sus.estado, plan: sus.plan });
  }
  return sus;
}

/* ------------------------------------------------------------
   Resumen para el cliente (GET /api/suscripcion)
   ------------------------------------------------------------ */

export async function resumen(sb, perfil) {
  const sus = await leerSuscripcion(sb, perfil.empresa_id);
  const uso = await consumoDe(sb, perfil.empresa_id);
  const plan = planDe(sus.plan);

  return {
    aplicada: sus.aplicada,
    aviso: sus.aviso || null,
    plan: {
      codigo: plan.codigo,
      nombre: plan.nombre,
      multi_almacen: plan.multi_almacen,
      modulos: plan.modulos || [],
    },
    estado: sus.estado,
    vencida: sus.vencida,
    en_prueba: sus.enPrueba,
    en_revision: sus.enRevision,
    trial_ends_at: sus.trial_ends_at,
    fecha_vencimiento: sus.fecha_vencimiento,
    limites: { ...plan.limites },
    uso,
    planes: catalogoPlanes(),
  };
}

/* Utilidades para otras capas (registro, pagos). */
export { DIAS_PRUEBA, PLAN_EN_PRUEBA, multiAlmacen };
