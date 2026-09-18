"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Pencil, Plus, Paperclip, Trash2, CheckCircle2, Clock, AlertCircle,
} from "lucide-react";
import { SehRequisito, SehCumplimiento } from "@/types/seh";
import { SehFormDialog } from "./seh-form-dialog";

interface CumplimientoConExtra extends Omit<SehCumplimiento, "archivos"> {
  archivos?: Array<{ id: string; nombre_archivo: string; storage_path: string; subido_at: string }>;
  responsable?: { id: string; nombre: string } | null;
}

interface SehFichaProps {
  requisito: SehRequisito & { ubicacion?: { nombre: string; tipo: string } };
  cumplimientosIniciales: CumplimientoConExtra[];
  canEdit: boolean;
  userId: string;
}

const TIPO_VEN_LABELS: Record<string, string> = {
  fecha_fija: "Fecha fija",
  anual: "Anual",
  periodico: "Periódico",
  sin_vencimiento: "Sin vencimiento",
  segun_plan: "Según plan",
};

function formatDate(d: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

interface CumplimientoModalState {
  open: boolean;
  cumplimientoId: string | null;
  fechaVencimiento: string;
  fechaPlanificada: string;
  fechaRealizada: string;
  observacion: string;
}

export function SehFicha({ requisito, cumplimientosIniciales, canEdit }: SehFichaProps) {
  const [cumplimientos, setCumplimientos] = useState<CumplimientoConExtra[]>(cumplimientosIniciales);
  const [editReqOpen, setEditReqOpen] = useState(false);

  const [modal, setModal] = useState<CumplimientoModalState>({
    open: false,
    cumplimientoId: null,
    fechaVencimiento: "",
    fechaPlanificada: "",
    fechaRealizada: "",
    observacion: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // File upload state
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [deletingArchivo, setDeletingArchivo] = useState<string | null>(null);

  function openModal(c: CumplimientoConExtra) {
    setModal({
      open: true,
      cumplimientoId: c.id,
      fechaVencimiento: c.fecha_vencimiento ?? "",
      fechaPlanificada: c.fecha_planificada ?? "",
      fechaRealizada: c.fecha_realizada ?? "",
      observacion: c.observacion ?? "",
    });
    setSaveError(null);
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false }));
  }

  async function handleSaveCumplimiento() {
    if (!modal.cumplimientoId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/seh/cumplimientos/${modal.cumplimientoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha_vencimiento: modal.fechaVencimiento || null,
          fecha_planificada: modal.fechaPlanificada || null,
          fecha_realizada: modal.fechaRealizada || null,
          observacion: modal.observacion || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error al guardar");
      }
      await refreshCumplimientos();
      closeModal();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFile(cumplimientoId: string, file: File) {
    setUploadingFor(cumplimientoId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("cumplimiento_id", cumplimientoId);
      const res = await fetch("/api/seh/archivos", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Error al subir archivo");
      await refreshCumplimientos();
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleDeleteArchivo(archivoId: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    setDeletingArchivo(archivoId);
    try {
      await fetch(`/api/seh/archivos/${archivoId}`, { method: "DELETE" });
      await refreshCumplimientos();
    } finally {
      setDeletingArchivo(null);
    }
  }

  async function refreshCumplimientos() {
    const res = await fetch(`/api/seh/requisitos/${requisito.id}`);
    if (res.ok) {
      const data = await res.json();
      setCumplimientos(data.cumplimientos ?? []);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Link href="/seh">
          <Button variant="ghost" size="sm" className="mt-0.5">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold">{requisito.nombre}</h1>
            {!requisito.aplica && (
              <Badge variant="outline" className="text-slate-400">No corresponde</Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            {requisito.ubicacion?.nombre} · {requisito.ambito === "seguridad_higiene" ? "Seguridad e Higiene" : "Medio Ambiente"}
          </p>
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setEditReqOpen(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
        )}
      </div>

      {/* Requisito meta */}
      <div className="rounded-lg border bg-white p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Norma / referencia</p>
          <p className="font-medium">{requisito.norma ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-0.5">Tipo de vencimiento</p>
          <p className="font-medium">{TIPO_VEN_LABELS[requisito.tipo_vencimiento] ?? requisito.tipo_vencimiento}</p>
        </div>
        {requisito.periodicidad_meses && (
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Periodicidad</p>
            <p className="font-medium">{requisito.periodicidad_meses} meses</p>
          </div>
        )}
        {requisito.observacion_general && (
          <div className="col-span-full">
            <p className="text-xs text-slate-500 mb-0.5">Observación general</p>
            <p className="text-slate-700">{requisito.observacion_general}</p>
          </div>
        )}
      </div>

      {/* Cumplimientos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">Historial de cumplimientos</h2>
        </div>

        <div className="space-y-3">
          {cumplimientos.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">Sin cumplimientos registrados</p>
          )}

          {cumplimientos.map((c) => {
            const done = !!c.fecha_realizada;
            const vencida = !done && c.fecha_vencimiento && c.fecha_vencimiento < new Date().toISOString().split("T")[0];

            return (
              <div key={c.id} className={`rounded-lg border bg-white overflow-hidden ${vencida ? "border-red-200" : done ? "border-green-200" : ""}`}>
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5">
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : vencida ? (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-slate-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-4 flex-wrap text-sm">
                      <span>
                        <span className="text-slate-500 text-xs">Vencimiento: </span>
                        <span className={`font-medium ${vencida ? "text-red-600" : ""}`}>{formatDate(c.fecha_vencimiento)}</span>
                      </span>
                      {c.fecha_planificada && (
                        <span>
                          <span className="text-slate-500 text-xs">Planificado: </span>
                          <span className="font-medium">{formatDate(c.fecha_planificada)}</span>
                        </span>
                      )}
                      {c.fecha_realizada && (
                        <span>
                          <span className="text-slate-500 text-xs">Realizado: </span>
                          <span className="font-medium text-green-700">{formatDate(c.fecha_realizada)}</span>
                        </span>
                      )}
                      {c.responsable && (
                        <span className="text-slate-500 text-xs">Responsable: {c.responsable.nombre}</span>
                      )}
                    </div>

                    {c.observacion && (
                      <p className="text-sm text-slate-600 mt-1">{c.observacion}</p>
                    )}

                    {/* Archivos */}
                    {(c.archivos ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(c.archivos ?? []).map((a) => (
                          <div key={a.id} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-1 text-xs">
                            <Paperclip className="h-3 w-3 text-slate-400" />
                            <span className="text-slate-700 max-w-[180px] truncate">{a.nombre_archivo}</span>
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteArchivo(a.id)}
                                disabled={deletingArchivo === a.id}
                                className="ml-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="sr-only"
                          disabled={uploadingFor === c.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadFile(c.id, file);
                            e.target.value = "";
                          }}
                        />
                        <div className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 cursor-pointer">
                          <Plus className="h-3.5 w-3.5" />
                          {uploadingFor === c.id ? "Subiendo..." : "Archivo"}
                        </div>
                      </label>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => openModal(c)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit cumplimiento modal */}
      <Dialog open={modal.open} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cumplimiento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Fecha de vencimiento</Label>
              <Input
                type="date"
                value={modal.fechaVencimiento}
                onChange={(e) => setModal((m) => ({ ...m, fechaVencimiento: e.target.value }))}
              />
            </div>
            <div>
              <Label>Fecha planificada</Label>
              <Input
                type="date"
                value={modal.fechaPlanificada}
                onChange={(e) => setModal((m) => ({ ...m, fechaPlanificada: e.target.value }))}
              />
            </div>
            <div>
              <Label>Fecha realizada</Label>
              <Input
                type="date"
                value={modal.fechaRealizada}
                onChange={(e) => setModal((m) => ({ ...m, fechaRealizada: e.target.value }))}
              />
              <p className="text-xs text-slate-400 mt-1">
                Al completar esta fecha en un requisito anual o periódico, se crea el próximo cumplimiento automáticamente.
              </p>
            </div>
            <div>
              <Label>Observación</Label>
              <Textarea
                rows={3}
                value={modal.observacion}
                onChange={(e) => setModal((m) => ({ ...m, observacion: e.target.value }))}
              />
            </div>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeModal} disabled={saving}>Cancelar</Button>
              <Button onClick={handleSaveCumplimiento} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit requisito dialog */}
      <SehFormDialog
        open={editReqOpen}
        onClose={() => setEditReqOpen(false)}
        onSaved={() => { setEditReqOpen(false); }}
        ubicaciones={requisito.ubicacion ? [{ id: requisito.ubicacion_id, nombre: requisito.ubicacion.nombre, tipo: requisito.ubicacion.tipo as "fabrica" | "deposito" | "empresa", activo: true }] : []}
        requisito={requisito}
      />
    </div>
  );
}
