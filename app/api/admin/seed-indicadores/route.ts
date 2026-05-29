import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Helper to calculate cumple
function calcularCumple(
  valor: string,
  metaValor: string | null,
  metaCondicion: string | null
): boolean | null {
  if (!valor || ["en proceso", "s/d", ""].includes(valor.trim().toLowerCase())) return null;
  if (!metaValor || !metaCondicion) return null;

  if (metaCondicion === "igual") {
    return valor.trim().toLowerCase() === metaValor.trim().toLowerCase();
  }

  const num = parseFloat(valor.replace(",", "."));
  const meta = parseFloat(metaValor.replace(",", "."));
  if (isNaN(num) || isNaN(meta)) return null;

  if (metaCondicion === "mayor") return num > meta;
  if (metaCondicion === "menor") return num < meta;
  return null;
}

export async function GET() {
  const admin = createAdminClient();
  const results: string[] = [];

  // ─── STEP 1: Create 7 missing users ───────────────────────────────────────
  const usersToCreate = [
    { nombre: "Johanna Remonda", email: "ventas@griffo.com.ar" },
    { nombre: "Camila Santacruz", email: "csantacruz@griffo.com.ar" },
    { nombre: "Constanza Cendon", email: "ml@griffo.com.ar" },
    { nombre: "Pablo Pirillo", email: "sistemas@griffo.com.ar" },
    { nombre: "Sofia Baldi", email: "cobranzas@griffo.com.ar" },
    { nombre: "Gustavo Benguardato", email: "gbenguardato@griffo.com.ar" },
    { nombre: "Julian Garcia", email: "comercial@griffo.com.ar" },
  ];

  for (const u of usersToCreate) {
    try {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: u.email,
        password: "Griffo2026!",
        email_confirm: true,
      });

      if (authError) {
        if (authError.message?.includes("already") || authError.message?.includes("exists")) {
          results.push(`SKIP auth: ${u.email} (already exists)`);
        } else {
          results.push(`ERROR creating auth user ${u.email}: ${authError.message}`);
          continue;
        }
      } else if (authData?.user) {
        const { error: insertError } = await admin.from("usuarios").insert({
          id: authData.user.id,
          nombre: u.nombre,
          email: u.email,
          rol: "editor",
          activo: true,
        });
        if (insertError && !insertError.message?.includes("duplicate") && !insertError.code?.includes("23505")) {
          results.push(`WARN inserting usuario ${u.email}: ${insertError.message}`);
        } else {
          results.push(`CREATED: ${u.nombre} (${u.email})`);
        }
      }
    } catch (e: unknown) {
      results.push(`EXCEPTION for ${u.email}: ${(e as Error).message}`);
    }
  }

  // ─── STEP 2: Look up all user IDs ─────────────────────────────────────────
  const { data: allUsuarios } = await admin.from("usuarios").select("id, nombre, email");
  const usuarios = allUsuarios ?? [];

  function findUser(
    conditions: Array<{ field: "email" | "nombre"; pattern: string }>
  ): string | null {
    for (const cond of conditions) {
      const found = usuarios.find((u) => {
        const val: string = (u[cond.field] ?? "").toLowerCase();
        const pat = cond.pattern.toLowerCase();
        return val.includes(pat);
      });
      if (found) return found.id;
    }
    return null;
  }

  const userMap: Record<string, string | null> = {
    "Diego Griffo": findUser([{ field: "email", pattern: "dgriffo" }, { field: "nombre", pattern: "diego" }, { field: "nombre", pattern: "griffo" }]),
    "Walter Riccelli": findUser([{ field: "nombre", pattern: "walter" }]),
    "Sergio Rodriguez": findUser([{ field: "nombre", pattern: "sergio" }]),
    "Javier Griffo": findUser([{ field: "nombre", pattern: "javier" }]),
    "Analia Coronatto": findUser([{ field: "nombre", pattern: "analia" }]),
    "Gustavo Nardi": findUser([{ field: "nombre", pattern: "nardi" }]),
    "Jose Machado": findUser([{ field: "nombre", pattern: "machado" }]),
    "Johanna Remonda": findUser([{ field: "nombre", pattern: "johanna" }, { field: "email", pattern: "ventas@griffo" }]),
    "Camila Santacruz": findUser([{ field: "nombre", pattern: "camila" }, { field: "email", pattern: "csantacruz" }]),
    "Constanza Cendon": findUser([{ field: "nombre", pattern: "constanza" }, { field: "email", pattern: "ml@griffo" }]),
    "Pablo Pirillo": findUser([{ field: "nombre", pattern: "pablo" }, { field: "email", pattern: "sistemas@griffo" }]),
    "Sofia Baldi": findUser([{ field: "nombre", pattern: "sofia" }, { field: "email", pattern: "cobranzas@griffo" }]),
    "Gustavo Benguardato": findUser([{ field: "nombre", pattern: "benguardato" }, { field: "email", pattern: "gbenguardato" }]),
    "Julian Garcia": findUser([{ field: "nombre", pattern: "julian" }, { field: "email", pattern: "comercial@griffo" }]),
  };

  results.push("\n--- User ID Lookup ---");
  for (const [name, id] of Object.entries(userMap)) {
    results.push(`${name}: ${id ?? "NOT FOUND"}`);
  }

  // ─── STEP 3: Insert indicadores ───────────────────────────────────────────
  const indicadoresData = [
    { orden: 1,  sector: "Dirección",                    nombre: "Cumplimiento de Certificación",                    objetivo_estrategico: "Mantener la Certificación de ISO",                   formula: "N/A",                                            responsable: "Diego Griffo",           frecuencia: "anual",   meta_valor: "Cumplir",  meta_condicion: "igual", meta_unidad: "texto" },
    { orden: 2,  sector: "Dirección",                    nombre: "Indicador RG",                                     objetivo_estrategico: "Mantenimiento de rentabilidad",                       formula: "",                                               responsable: "Diego Griffo",           frecuencia: "mensual", meta_valor: "0.06",     meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 3,  sector: "Calidad",                      nombre: "Cantidad devoluciones de Clientes",                objetivo_estrategico: "Satisfaccion del Cliente",                            formula: "Cantidad devoluciones de Clientes totales",      responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "6",        meta_condicion: "menor", meta_unidad: "unidades" },
    { orden: 4,  sector: "Calidad",                      nombre: "Cantidad de devoluciones válidas",                 objetivo_estrategico: "Satisfaccion del Cliente",                            formula: "Cantidad de devoluciones validas",               responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "6",        meta_condicion: "menor", meta_unidad: "unidades" },
    { orden: 5,  sector: "Calidad",                      nombre: "Cantidad de devoluciones no válidas",              objetivo_estrategico: "Satisfaccion del Cliente",                            formula: "Cantidad de devoluciones no validas",            responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "0",        meta_condicion: "menor", meta_unidad: "unidades" },
    { orden: 6,  sector: "Calidad",                      nombre: "Cantidad de devoluciones por problemas Administrativos", objetivo_estrategico: "Satisfaccion del Cliente",                   formula: "Cantidad de devoluciones por problemas Administrativos", responsable: "Johanna Remonda",    frecuencia: "mensual", meta_valor: "0",        meta_condicion: "menor", meta_unidad: "unidades" },
    { orden: 7,  sector: "Calidad",                      nombre: "Índice de reclamos (ML)",                          objetivo_estrategico: "Satisfaccion del Cliente",                            formula: "Cantidad de reclamos (ML)",                      responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "7",        meta_condicion: "menor", meta_unidad: "unidades" },
    { orden: 8,  sector: "Calidad",                      nombre: "Índice de NC de proveedores",                      objetivo_estrategico: "Reducir NC Proveedores",                              formula: "NC Proveedores / Cant recep de proveedores",     responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "0.5",      meta_condicion: "menor", meta_unidad: "%" },
    { orden: 9,  sector: "Calidad",                      nombre: "Índice de NC internas",                            objetivo_estrategico: "Reducir NC Internas",                                 formula: "Cantidad NC interna / Cantidad de empleados",    responsable: "Walter Riccelli",        frecuencia: "mensual", meta_valor: "0.25",     meta_condicion: "menor", meta_unidad: "%" },
    { orden: 10, sector: "Producción",                   nombre: "Índice de Productividad de Fuelles",               objetivo_estrategico: "Aumentar la productividad de fuelles",                formula: "Total producido / total ST actual",              responsable: "Sergio Rodriguez",       frecuencia: "mensual", meta_valor: "90",       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 11, sector: "Producción",                   nombre: "Índice de Scrap de fuelles",                       objetivo_estrategico: "Reducir el scrap en fuelles",                         formula: "Scrap de fuelles / Total producido",             responsable: "Sergio Rodriguez",       frecuencia: "mensual", meta_valor: "0.93",     meta_condicion: "menor", meta_unidad: "%" },
    { orden: 12, sector: "Planificación de la producción", nombre: "Índice de cumplimiento de entrega de pedidos",   objetivo_estrategico: "Cumplir con los pedidos",                             formula: "Unid no entregadas/Unid entregadas",             responsable: "Javier Griffo",          frecuencia: "mensual", meta_valor: "0.5",      meta_condicion: "menor", meta_unidad: "%" },
    { orden: 13, sector: "RRHH",                         nombre: "Índice de ausentismo",                             objetivo_estrategico: "Disminuir el ausentismo",                             formula: "Dias de ausentismo/dias teorico",                responsable: "Analia Coronatto",       frecuencia: "mensual", meta_valor: "1.5",      meta_condicion: "menor", meta_unidad: "%" },
    { orden: 14, sector: "Compras",                      nombre: "Índice de Cumplimiento de Pedidos de Producción Nacional", objetivo_estrategico: "Cumplir con los pedidos Prod Origen Nacional", formula: "Unid no entregadas/Unid vendidas",             responsable: "Gustavo Nardi",          frecuencia: "mensual", meta_valor: "0.25",     meta_condicion: "menor", meta_unidad: "%" },
    { orden: 15, sector: "Compras",                      nombre: "Índice de Cumplimiento de Pedidos de Producción importada", objetivo_estrategico: "Cumplir con los pedidos Prod Importados",  formula: "Unid no entregadas/Unid vendidas",             responsable: "Gustavo Nardi",          frecuencia: "mensual", meta_valor: "0.85",     meta_condicion: "menor", meta_unidad: "%" },
    { orden: 16, sector: "Comercial",                    nombre: "Encuesta del Cliente",                             objetivo_estrategico: "Satisfacción del cliente",                            formula: "N/A",                                            responsable: "Camila Santacruz",       frecuencia: "anual",   meta_valor: "3",        meta_condicion: "mayor", meta_unidad: "puntaje" },
    { orden: 17, sector: "Comercial",                    nombre: "Crecimiento de Ventas industriales",               objetivo_estrategico: "Aumentar las ventas de piezas industriales",          formula: "Unidades vendidas/unidades objetivo",           responsable: "Gustavo Benguardato",    frecuencia: "mensual", meta_valor: "95",       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 18, sector: "Comercial",                    nombre: "Crecimiento de Ventas de fuelles",                 objetivo_estrategico: "Aumentar las ventas de fuelles After market",         formula: "Unidades vendidas/unidades objetivo",           responsable: "Julian Garcia",          frecuencia: "mensual", meta_valor: null,       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 19, sector: "Comercial",                    nombre: "Satisfacción del Cliente – Canal Mercado Libre",   objetivo_estrategico: "Satisfacción del cliente Mercado libre",              formula: "Semaforo Reputacion Mercado libre",              responsable: "Constanza Cendon",       frecuencia: "mensual", meta_valor: "verde",    meta_condicion: "igual", meta_unidad: "color" },
    { orden: 20, sector: "Mantenimiento",                nombre: "Grado de Cumplimiento del Plan Preventivo",        objetivo_estrategico: "cumplimiento plan preventivo",                        formula: "se baja de sistema",                             responsable: "Jose Machado",           frecuencia: "mensual", meta_valor: "90",       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 21, sector: "Sistemas IT",                  nombre: "Grado de Cumplimiento del Respaldo de Información", objetivo_estrategico: "Cumplimiento efectivo de backups",                   formula: "",                                               responsable: "Pablo Pirillo",          frecuencia: "mensual", meta_valor: "95",       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 22, sector: "Diseño",                       nombre: "Grado de Cumplimiento del Proceso de Diseño",      objetivo_estrategico: "Cumplir en tiempo y forma con los Diseños",           formula: "",                                               responsable: "Diego Griffo",           frecuencia: "anual",   meta_valor: "90",       meta_condicion: "mayor", meta_unidad: "%" },
    { orden: 23, sector: "Ventas",                       nombre: "Tiempos de Entrega (Distribuidores)",              objetivo_estrategico: "Reducir los tiempos de Entrega",                      formula: "Medido en Dias",                                 responsable: "Johanna Remonda",        frecuencia: "mensual", meta_valor: "8",        meta_condicion: "menor", meta_unidad: "dias" },
    { orden: 24, sector: "Ventas",                       nombre: "Tiempos de Entrega (GPDV y PDV)",                  objetivo_estrategico: "Reducir los tiempos de Entrega",                      formula: "Medido en Dias",                                 responsable: "Johanna Remonda",        frecuencia: "mensual", meta_valor: "5",        meta_condicion: "menor", meta_unidad: "dias" },
    { orden: 25, sector: "Cobranzas",                    nombre: "Dias de Cobranza",                                 objetivo_estrategico: "Reducir dias de Cobranza",                            formula: "Medido en Dias",                                 responsable: "Sofia Baldi",            frecuencia: "mensual", meta_valor: "30",       meta_condicion: "menor", meta_unidad: "dias" },
    { orden: 26, sector: "Cobranzas",                    nombre: "Porcentaje Cobranzas Vencidas",                    objetivo_estrategico: "Reducir Porcentaje de Vencidas",                      formula: "%",                                              responsable: "Sofia Baldi",            frecuencia: "mensual", meta_valor: null,       meta_condicion: "menor", meta_unidad: "%" },
  ];

  results.push("\n--- Inserting Indicadores ---");
  const insertedIndicadores: Record<string, string> = {}; // nombre → id

  for (const ind of indicadoresData) {
    // Check if exists
    const { data: existing } = await admin
      .from("indicadores")
      .select("id")
      .eq("nombre", ind.nombre)
      .single();

    if (existing) {
      results.push(`SKIP indicador: ${ind.nombre}`);
      insertedIndicadores[ind.nombre] = existing.id;
      continue;
    }

    const responsableId = userMap[ind.responsable] ?? null;
    if (!responsableId) {
      results.push(`WARN: No user found for "${ind.responsable}" — inserting indicador without responsable`);
    }

    const { data: newInd, error: indError } = await admin
      .from("indicadores")
      .insert({
        sector: ind.sector,
        nombre: ind.nombre,
        objetivo_estrategico: ind.objetivo_estrategico,
        formula: ind.formula || null,
        responsable_id: responsableId,
        frecuencia: ind.frecuencia,
        meta_valor: ind.meta_valor,
        meta_condicion: ind.meta_condicion,
        meta_unidad: ind.meta_unidad,
        orden: ind.orden,
        activo: true,
      })
      .select("id")
      .single();

    if (indError) {
      results.push(`ERROR inserting "${ind.nombre}": ${indError.message}`);
    } else if (newInd) {
      insertedIndicadores[ind.nombre] = newInd.id;
      results.push(`CREATED indicador: ${ind.nombre}`);
    }
  }

  // ─── STEP 4: Insert historical data ───────────────────────────────────────
  results.push("\n--- Inserting Historical Registros ---");

  // Build a lookup from nombre → { meta_valor, meta_condicion }
  const { data: allIndicadores } = await admin
    .from("indicadores")
    .select("id, nombre, meta_valor, meta_condicion");

  const indByNombre = Object.fromEntries(
    (allIndicadores ?? []).map((i) => [i.nombre, i])
  );

  // Historical data: [nombre_partial, anio, mes, valor]
  const historicalData: Array<[string, number, number, string]> = [
    // Indicador RG
    ["Indicador RG", 2026, 1, "0.15"],
    ["Indicador RG", 2026, 2, "-0.35"],
    ["Indicador RG", 2026, 3, "0.08"],
    ["Indicador RG", 2026, 4, "-0.04"],
    // Devoluciones Clientes
    ["Cantidad devoluciones de Clientes", 2026, 1, "23"],
    ["Cantidad devoluciones de Clientes", 2026, 2, "9"],
    ["Cantidad devoluciones de Clientes", 2026, 3, "23"],
    ["Cantidad devoluciones de Clientes", 2026, 4, "18"],
    // Devoluciones válidas
    ["Cantidad de devoluciones válidas", 2026, 1, "4"],
    ["Cantidad de devoluciones válidas", 2026, 2, "2"],
    ["Cantidad de devoluciones válidas", 2026, 3, "2"],
    ["Cantidad de devoluciones válidas", 2026, 4, "9"],
    // Devoluciones no válidas
    ["Cantidad de devoluciones no válidas", 2026, 1, "10"],
    ["Cantidad de devoluciones no válidas", 2026, 2, "0"],
    ["Cantidad de devoluciones no válidas", 2026, 3, "2"],
    ["Cantidad de devoluciones no válidas", 2026, 4, "9"],
    // Devoluciones Adm
    ["Cantidad de devoluciones por problemas Administrativos", 2026, 1, "2"],
    ["Cantidad de devoluciones por problemas Administrativos", 2026, 2, "1"],
    ["Cantidad de devoluciones por problemas Administrativos", 2026, 3, "3"],
    ["Cantidad de devoluciones por problemas Administrativos", 2026, 4, "4"],
    // Reclamos ML
    ["Índice de reclamos (ML)", 2026, 1, "17"],
    ["Índice de reclamos (ML)", 2026, 2, "7"],
    ["Índice de reclamos (ML)", 2026, 3, "18"],
    ["Índice de reclamos (ML)", 2026, 4, "11"],
    // NC proveedores
    ["Índice de NC de proveedores", 2026, 1, "0.02"],
    ["Índice de NC de proveedores", 2026, 2, "0"],
    ["Índice de NC de proveedores", 2026, 3, "0.01"],
    ["Índice de NC de proveedores", 2026, 4, "0"],
    // NC internas
    ["Índice de NC internas", 2026, 1, "0.28"],
    ["Índice de NC internas", 2026, 2, "0.09"],
    ["Índice de NC internas", 2026, 3, "0.02"],
    ["Índice de NC internas", 2026, 4, "0.10"],
    // Productividad Fuelles
    ["Índice de Productividad de Fuelles", 2026, 1, "89.66"],
    ["Índice de Productividad de Fuelles", 2026, 2, "94.84"],
    ["Índice de Productividad de Fuelles", 2026, 3, "98.45"],
    ["Índice de Productividad de Fuelles", 2026, 4, "93.90"],
    // Scrap fuelles
    ["Índice de Scrap de fuelles", 2026, 1, "1.28"],
    ["Índice de Scrap de fuelles", 2026, 2, "0.76"],
    ["Índice de Scrap de fuelles", 2026, 3, "0.76"],
    ["Índice de Scrap de fuelles", 2026, 4, "0.97"],
    // Cumpl entrega pedidos
    ["Índice de cumplimiento de entrega de pedidos", 2026, 1, "0.15"],
    ["Índice de cumplimiento de entrega de pedidos", 2026, 2, "0.05"],
    ["Índice de cumplimiento de entrega de pedidos", 2026, 3, "0.105"],
    ["Índice de cumplimiento de entrega de pedidos", 2026, 4, "0.16"],
    // Ausentismo
    ["Índice de ausentismo", 2026, 1, "2.12"],
    ["Índice de ausentismo", 2026, 2, "1.4"],
    ["Índice de ausentismo", 2026, 3, "3.34"],
    ["Índice de ausentismo", 2026, 4, "4.55"],
    // Cumpl Ped Nac
    ["Índice de Cumplimiento de Pedidos de Producción Nacional", 2026, 1, "0.11"],
    ["Índice de Cumplimiento de Pedidos de Producción Nacional", 2026, 2, "0.20"],
    ["Índice de Cumplimiento de Pedidos de Producción Nacional", 2026, 3, "0.223"],
    ["Índice de Cumplimiento de Pedidos de Producción Nacional", 2026, 4, "0"],
    // Cumpl Ped Imp
    ["Índice de Cumplimiento de Pedidos de Producción importada", 2026, 3, "0.113"],
    ["Índice de Cumplimiento de Pedidos de Producción importada", 2026, 4, "0.653"],
    // ML satisfacción
    ["Satisfacción del Cliente – Canal Mercado Libre", 2026, 1, "verde"],
    ["Satisfacción del Cliente – Canal Mercado Libre", 2026, 2, "verde"],
    ["Satisfacción del Cliente – Canal Mercado Libre", 2026, 3, "verde"],
    ["Satisfacción del Cliente – Canal Mercado Libre", 2026, 4, "verde"],
    // Plan Preventivo
    ["Grado de Cumplimiento del Plan Preventivo", 2026, 1, "100"],
    ["Grado de Cumplimiento del Plan Preventivo", 2026, 2, "100"],
    ["Grado de Cumplimiento del Plan Preventivo", 2026, 3, "100"],
    ["Grado de Cumplimiento del Plan Preventivo", 2026, 4, "100"],
    // Respaldo Info
    ["Grado de Cumplimiento del Respaldo de Información", 2026, 1, "ok"],
    ["Grado de Cumplimiento del Respaldo de Información", 2026, 2, "ok"],
    ["Grado de Cumplimiento del Respaldo de Información", 2026, 3, "ok"],
    ["Grado de Cumplimiento del Respaldo de Información", 2026, 4, "ok"],
    // Tiempos Distrib
    ["Tiempos de Entrega (Distribuidores)", 2026, 1, "5.58"],
    ["Tiempos de Entrega (Distribuidores)", 2026, 2, "5.74"],
    ["Tiempos de Entrega (Distribuidores)", 2026, 3, "5.54"],
    ["Tiempos de Entrega (Distribuidores)", 2026, 4, "5.23"],
    // Tiempos GPDV
    ["Tiempos de Entrega (GPDV y PDV)", 2026, 1, "3.59"],
    ["Tiempos de Entrega (GPDV y PDV)", 2026, 2, "6.89"],
    ["Tiempos de Entrega (GPDV y PDV)", 2026, 3, "3"],
    ["Tiempos de Entrega (GPDV y PDV)", 2026, 4, "3.58"],
    // Dias Cobranza
    ["Dias de Cobranza", 2026, 1, "30"],
    ["Dias de Cobranza", 2026, 2, "24"],
    ["Dias de Cobranza", 2026, 3, "5"],
    ["Dias de Cobranza", 2026, 4, "6"],
    // % Cobranzas Vencidas
    ["Porcentaje Cobranzas Vencidas", 2026, 1, "5"],
    ["Porcentaje Cobranzas Vencidas", 2026, 2, "27"],
    ["Porcentaje Cobranzas Vencidas", 2026, 3, "5"],
    ["Porcentaje Cobranzas Vencidas", 2026, 4, "9"],
  ];

  for (const [nombre, anio, mes, valor] of historicalData) {
    const ind = indByNombre[nombre];
    if (!ind) {
      results.push(`SKIP registro: indicador "${nombre}" not found`);
      continue;
    }

    const cumple = calcularCumple(valor, ind.meta_valor, ind.meta_condicion);

    const { error: regError } = await admin
      .from("indicador_registros")
      .upsert(
        {
          indicador_id: ind.id,
          anio,
          mes,
          valor,
          cumple,
          comentario: null,
          cargado_por: null,
        },
        { onConflict: "indicador_id,anio,mes", ignoreDuplicates: true }
      );

    if (regError) {
      results.push(`ERROR registro ${nombre} ${anio}/${mes}: ${regError.message}`);
    } else {
      results.push(`OK registro: ${nombre} ${anio}/${mes} = ${valor} (cumple: ${cumple})`);
    }
  }

  return NextResponse.json({ ok: true, results });
}
