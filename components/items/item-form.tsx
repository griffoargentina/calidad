"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, Upload, FileText, BookOpen } from "lucide-react";

const TIPO_DOCUMENTO_OPTIONS = [
  { value: "MA", label: "MA — Manual" },
  { value: "PR", label: "PR — Procedimiento" },
  { value: "IT", label: "IT — Instructivo de Trabajo" },
  { value: "FO", label: "FO — Formato / Formulario" },
  { value: "RE", label: "RE — Registro" },
  { value: "DS", label: "DS — Documento de Soporte" },
];

const FRECUENCIAS = [
  { label: "Mensual",    dias: 30 },
  { label: "Trimestral", dias: 90 },
  { label: "Semestral",  dias: 180 },
  { label: "Anual",      dias: 365 },
];

function sumarDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().split("T")[0];
}

interface ItemInicial {
  id: string;
  tipo?: string | null;
  titulo: string;
  descripcion: string | null;
  clausula_iso: string;
  area_id: string | null;
  responsable_id: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  frecuencia_dias: number | null;
  requiere_aprobacion: boolean;
  es_borrador: boolean;
  etiquetas: string[];
  codigo?: string | null;
}

interface ItemFormProps {
  areas: { id: string; nombre: string }[];
  clausulas: { id: string; titulo: string }[];
  usuarios: { id: string; nombre: string }[];
  plantillas: unknown[];
  usuarioActual: { rol: string; area_id: string | null; tipos_habilitados: string[] };
  itemInicial?: ItemInicial;
  clausulaInicial?: string;
}

function ArchivoInput({ label, icon: Icon, archivo, setArchivo }: {
  label: string;
  icon: React.ElementType;
  archivo: File | null;
  setArchivo: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div
        onClick={() => ref.current?.click()}
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
      >
        {archivo ? (
          <div className="flex items-center justify-center gap-2 text-primary">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium truncate max-w-xs">{archivo.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); setArchivo(null); }} className="text-muted-foreground hover:text-destructive ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="text-muted-foreground">
            <Upload className="h-6 w-6 mx-auto mb-1 opacity-40" />
            <p className="text-sm">{label}</p>
            <p className="text-xs mt-0.5 opacity-60">PDF, Excel, Word — opcional</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" className="hidden" accept=".pdf,.xlsx,.xls,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { const f = e.target.files?.[0]; if (f) setArchivo(f); }} />
    </div>
  );
}

function CodigoPreview({ tipo }: { tipo: string }) {
  const [codigo, setCodigo] = useState<string | null>(null);
  useEffect(() => {
    if (!tipo) { setCodigo(null); return; }
    fetch(`/api/items/preview-codigo?prefijo=${tipo}`)
      .then(r => r.json())
      .then(d => setCodigo(d.codigo ?? null));
  }, [tipo]);
  if (!codigo) return null;
  return (
    <p className="text-xs text-muted-foreground mt-1">
      Código: <span className="font-mono font-semibold text-slate-700">{codigo}</span>
      <span className="opacity-60"> (se asigna al subir)</span>
    </p>
  );
}

export function ItemForm({ areas, clausulas, usuarios, usuarioActual, itemInicial, clausulaInicial }: ItemFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // General
  const [titulo, setTitulo] = useState(itemInicial?.titulo ?? "");
  const [descripcion, setDescripcion] = useState(itemInicial?.descripcion ?? "");
  const [clausulaIso, setClausulaIso] = useState(itemInicial?.clausula_iso ?? clausulaInicial ?? "");
  const [areaId, setAreaId] = useState(itemInicial?.area_id ?? usuarioActual.area_id ?? "__none__");
  const [responsableId, setResponsableId] = useState(itemInicial?.responsable_id ?? "__none__");
  const [etiquetas, setEtiquetas] = useState<string[]>(itemInicial?.etiquetas ?? []);
  const [etiquetaInput, setEtiquetaInput] = useState("");

  // Procedimiento
  const [sinProc, setSinProc] = useState(false);
  const [tipoProc, setTipoProc] = useState("");
  const [revisionProc, setRevisionProc] = useState("1");
  const [vencProc, setVencProc] = useState(sumarDias(365));
  const [archivoProc, setArchivoProc] = useState<File | null>(null);

  // Documento
  const [sinDoc, setSinDoc] = useState(false);
  const [tipoDoc, setTipoDoc] = useState("");
  const [revisionDoc, setRevisionDoc] = useState("1");
  const [frecDoc, setFrecDoc] = useState("__none__");
  const [vencDoc, setVencDoc] = useState("");
  const [archivoDoc, setArchivoDoc] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addEtiqueta() {
    const tag = etiquetaInput.trim();
    if (tag && !etiquetas.includes(tag)) setEtiquetas([...etiquetas, tag]);
    setEtiquetaInput("");
  }

  async function uploadArchivo(itemId: string, file: File, categoria: string, tipo: string, revision: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("item_id", itemId);
    fd.append("categoria", categoria);
    fd.append("version", revision || "1");
    if (tipo) fd.append("tipo_documento", tipo);
    await fetch("/api/upload", { method: "POST", body: fd });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo || !clausulaIso) { setError("Título y cláusula ISO son obligatorios."); return; }
    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      tipo: "documento",
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      clausula_iso: clausulaIso,
      area_id: areaId !== "__none__" ? areaId : null,
      responsable_id: responsableId !== "__none__" ? responsableId : null,
      fecha_emision: new Date().toISOString().split("T")[0],
      fecha_vencimiento: vencDoc || null,
      proc_fecha_vencimiento: vencProc || null,
      frecuencia_dias: frecDoc !== "__none__" ? parseInt(frecDoc) : null,
      requiere_aprobacion: false,
      es_borrador: false,
      etiquetas,
      estado: "vigente",
    };

    let result;
    if (itemInicial) {
      result = await supabase.from("items").update(payload).eq("id", itemInicial.id).select().single();
    } else {
      result = await supabase.from("items").insert(payload).select().single();
    }

    if (result.error) { setError(result.error.message); setLoading(false); return; }

    const itemId = result.data.id;
    if (archivoProc) await uploadArchivo(itemId, archivoProc, "procedimiento", tipoProc, revisionProc);
    if (archivoDoc)  await uploadArchivo(itemId, archivoDoc,  "documento",     tipoDoc,  revisionDoc);

    router.push(`/items/${itemId}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* GENERAL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Información general</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Cláusula ISO <span className="text-destructive">*</span></Label>
            {clausulaInicial ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed truncate">
                {clausulaIso} — {clausulas.find(c => c.id === clausulaIso)?.titulo ?? ""}
              </div>
            ) : (
              <Select value={clausulaIso} onValueChange={setClausulaIso}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cláusula..." /></SelectTrigger>
                <SelectContent>{clausulas.map(c => <SelectItem key={c.id} value={c.id}>{c.id} — {c.titulo}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Título <span className="text-destructive">*</span></Label>
            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ej: Procedimiento de control de documentos" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin área</SelectItem>
                  {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Responsable</Label>
              <Select value={responsableId} onValueChange={setResponsableId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin responsable</SelectItem>
                  {usuarios.map(u => <SelectItem key={u.id} value={u.id}>{u.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Descripción o alcance..." rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex gap-2">
              <Input value={etiquetaInput} onChange={e => setEtiquetaInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addEtiqueta(); } }} placeholder="Ej: crítico, auditoría 2026..." className="flex-1" />
              <Button type="button" variant="outline" size="icon" onClick={addEtiqueta}><Plus className="h-4 w-4" /></Button>
            </div>
            {etiquetas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {etiquetas.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1">{tag}
                    <button type="button" onClick={() => setEtiquetas(etiquetas.filter(t => t !== tag))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* PROCEDIMIENTO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              Procedimiento
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={sinProc} onChange={e => setSinProc(e.target.checked)} className="rounded" />
              <span className="text-xs font-normal text-muted-foreground">No corresponde</span>
            </label>
          </CardTitle>
        </CardHeader>
        {!sinProc && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={tipoProc} onValueChange={setTipoProc}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin tipo</SelectItem>
                    {TIPO_DOCUMENTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {tipoProc && tipoProc !== "__none__" && <CodigoPreview tipo={tipoProc} />}
              </div>
              <div className="space-y-2">
                <Label>Revisión</Label>
                <Input value={revisionProc} onChange={e => setRevisionProc(e.target.value)} placeholder="Ej: 1, 2, A..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">Anual</div>
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input type="date" value={vencProc} onChange={e => setVencProc(e.target.value)} />
              </div>
            </div>
            <ArchivoInput label="Adjuntar procedimiento" icon={BookOpen} archivo={archivoProc} setArchivo={setArchivoProc} />
          </CardContent>
        )}
        {sinProc && (
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Este ítem no requiere procedimiento.</p>
          </CardContent>
        )}
      </Card>

      {/* DOCUMENTO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Documento
            </div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={sinDoc} onChange={e => setSinDoc(e.target.checked)} className="rounded" />
              <span className="text-xs font-normal text-muted-foreground">No corresponde</span>
            </label>
          </CardTitle>
        </CardHeader>
        {!sinDoc && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select value={tipoDoc} onValueChange={setTipoDoc}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin tipo</SelectItem>
                    {TIPO_DOCUMENTO_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {tipoDoc && tipoDoc !== "__none__" && <CodigoPreview tipo={tipoDoc} />}
              </div>
              <div className="space-y-2">
                <Label>Revisión</Label>
                <Input value={revisionDoc} onChange={e => setRevisionDoc(e.target.value)} placeholder="Ej: 1, 2, A..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Select value={frecDoc} onValueChange={v => { setFrecDoc(v); if (v !== "__none__") setVencDoc(sumarDias(parseInt(v))); }}>
                  <SelectTrigger><SelectValue placeholder="Sin frecuencia" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sin frecuencia</SelectItem>
                    {FRECUENCIAS.map(f => <SelectItem key={f.dias} value={f.dias.toString()}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vencimiento</Label>
                <Input type="date" value={vencDoc} onChange={e => setVencDoc(e.target.value)} />
              </div>
            </div>
            <ArchivoInput label="Adjuntar documento" icon={FileText} archivo={archivoDoc} setArchivo={setArchivoDoc} />
          </CardContent>
        )}
        {sinDoc && (
          <CardContent>
            <p className="text-sm text-muted-foreground italic">Este ítem no requiere documento.</p>
          </CardContent>
        )}
      </Card>

      {error && <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">{error}</p>}

      <div className="flex gap-3 justify-end pb-8">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : itemInicial ? "Guardar cambios" : "Crear documento"}
        </Button>
      </div>
    </form>
  );
}
