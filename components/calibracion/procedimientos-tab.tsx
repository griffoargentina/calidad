"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, Pencil, Trash2, Upload, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CodigoDocumentoInput } from "@/components/ui/codigo-documento-input";

interface TipoDoc { id: string; prefijo: string; nombre: string }

interface Procedimiento {
  id: string;
  titulo: string;
  descripcion: string | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  codigo_doc?: string | null;  // código asignado al archivo (ej: PR-11)
  created_at: string;
  updated_at: string;
}

interface Props {
  procedimientosIniciales: Procedimiento[];
  canEdit: boolean;
}

export function ProcedimientosTab({ procedimientosIniciales, canEdit }: Props) {
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>(procedimientosIniciales);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Procedimiento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Procedimiento | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [tipoDoc, setTipoDoc] = useState("__none__");
  const [codigoNum, setCodigoNum] = useState("");
  const [tipos, setTipos] = useState<TipoDoc[]>([]);

  useEffect(() => {
    fetch("/api/procesos/tipos-documento")
      .then(r => r.json())
      .then(d => setTipos(Array.isArray(d) ? d : []));
  }, []);

  function openNew() { setEditTarget(null); setTitulo(""); setDescripcion(""); setPendingFile(null); setTipoDoc("__none__"); setCodigoNum(""); setDialogOpen(true); }
  function openEdit(p: Procedimiento) { setEditTarget(p); setTitulo(p.titulo); setDescripcion(p.descripcion ?? ""); setPendingFile(null); setTipoDoc("__none__"); setCodigoNum(""); setDialogOpen(true); }
  function closeDialog() { setDialogOpen(false); setEditTarget(null); setPendingFile(null); setTipoDoc("__none__"); setCodigoNum(""); }

  async function handleSave() {
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      if (editTarget) {
        const updates: Record<string, string> = { titulo: titulo.trim(), descripcion: descripcion.trim() };
        if (pendingFile) {
          const fd = new FormData(); fd.append("file", pendingFile); fd.append("folder", `procedimientos/${editTarget.id}`); fd.append("categoria", "procedimiento");
          if (tipoDoc !== "__none__") {
            fd.append("tipo_documento", tipoDoc);
            if (codigoNum) fd.append("codigo_manual", `${tipoDoc}-${codigoNum}`);
          }
          const uploadRes = await fetch("/api/calibracion/upload", { method: "POST", body: fd });
          if (!uploadRes.ok) throw new Error("Error al subir archivo");
          const { url, nombre, codigo } = await uploadRes.json();
          updates.archivo_url = url; updates.archivo_nombre = nombre;
          if (codigo) (updates as Record<string, string>).codigo_doc = codigo;
        }
        const codigoFromUpload = (updates as Record<string, string>).codigo_doc;
        delete (updates as Record<string, string>).codigo_doc;
        const res = await fetch(`/api/calibracion/procedimientos/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
        if (!res.ok) throw new Error("Error al guardar");
        const updated = await res.json();
        setProcedimientos((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, codigo_doc: codigoFromUpload ?? p.codigo_doc } : p)));
      } else {
        const res = await fetch("/api/calibracion/procedimientos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ titulo: titulo.trim(), descripcion: descripcion.trim() }) });
        if (!res.ok) throw new Error("Error al crear");
        const created: Procedimiento = await res.json();
        setProcedimientos((prev) => [...prev, created]);
        if (pendingFile) {
          const fd = new FormData(); fd.append("file", pendingFile); fd.append("folder", `procedimientos/${created.id}`); fd.append("categoria", "procedimiento");
          if (tipoDoc !== "__none__") {
            fd.append("tipo_documento", tipoDoc);
            if (codigoNum) fd.append("codigo_manual", `${tipoDoc}-${codigoNum}`);
          }
          const uploadRes = await fetch("/api/calibracion/upload", { method: "POST", body: fd });
          if (uploadRes.ok) {
            const { url, nombre, codigo } = await uploadRes.json();
            const patchRes = await fetch(`/api/calibracion/procedimientos/${created.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archivo_url: url, archivo_nombre: nombre }) });
            if (patchRes.ok) { const patched = await patchRes.json(); setProcedimientos((prev) => prev.map((p) => (p.id === patched.id ? { ...patched, codigo_doc: codigo ?? p.codigo_doc } : p))); }
          }
        }
      }
      closeDialog();
    } catch (e) { alert(e instanceof Error ? e.message : "Error al guardar"); } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/calibracion/procedimientos/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setProcedimientos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { alert(e instanceof Error ? e.message : "Error al eliminar"); } finally { setDeleting(false); }
  }

  async function handleFileUploadInline(proc: Procedimiento, file: File) {
    setUploadingFor(proc.id);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("folder", `procedimientos/${proc.id}`); fd.append("categoria", "procedimiento");
      const uploadRes = await fetch("/api/calibracion/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Error al subir archivo");
      const { url, nombre, codigo } = await uploadRes.json();
      const patchRes = await fetch(`/api/calibracion/procedimientos/${proc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archivo_url: url, archivo_nombre: nombre }) });
      if (!patchRes.ok) throw new Error("Error al actualizar");
      const updated = await patchRes.json();
      setProcedimientos((prev) => prev.map((p) => (p.id === updated.id ? { ...updated, codigo_doc: codigo ?? p.codigo_doc } : p)));
    } catch (e) { alert(e instanceof Error ? e.message : "Error al subir"); } finally { setUploadingFor(null); }
  }

  return (
    <div className="space-y-4">
      {canEdit && (<div className="flex justify-end"><Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1.5" />Nuevo procedimiento</Button></div>)}
      {procedimientos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-lg border bg-white">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No hay procedimientos cargados</p>
          {canEdit && <p className="text-xs text-muted-foreground mt-1">Hacé clic en &ldquo;Nuevo procedimiento&rdquo; para agregar uno</p>}
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/30"><TableHead className="w-[260px]">Título</TableHead><TableHead>Descripción</TableHead><TableHead className="w-[220px]">Archivo</TableHead>{canEdit && <TableHead className="w-[120px] text-right">Acciones</TableHead>}</TableRow></TableHeader>
            <TableBody>
              {procedimientos.map((proc) => (
                <TableRow key={proc.id}>
                  <TableCell className="font-medium text-sm">{proc.titulo}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{proc.descripcion || <span className="italic text-muted-foreground/60">Sin descripción</span>}</TableCell>
                  <TableCell>
                    {proc.archivo_url ? (
                      <div className="flex items-center gap-2">
                        <a href={proc.archivo_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"><ExternalLink className="h-3 w-3" />{proc.archivo_nombre ?? "Ver archivo"}</a>
                        {proc.codigo_doc && <Badge variant="outline" className="font-mono text-xs bg-purple-50 text-purple-700 border-purple-200">{proc.codigo_doc}</Badge>}
                      </div>
                    ) : canEdit ? (
                      <div>
                        <input type="file" className="hidden" id={`file-inline-${proc.id}`} accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUploadInline(proc, f); e.target.value = ""; }} />
                        <label htmlFor={`file-inline-${proc.id}`}>
                          {uploadingFor === proc.id ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-wait"><Loader2 className="h-3 w-3 animate-spin" />Subiendo...</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-primary"><Upload className="h-3 w-3" />Subir archivo</span>}
                        </label>
                      </div>
                    ) : <span className="text-xs text-muted-foreground/50">Sin archivo</span>}
                  </TableCell>
                  {canEdit && <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(proc)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(proc)}><Trash2 className="h-3.5 w-3.5" /></Button></div></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-2 border-t bg-muted/20 text-xs text-muted-foreground">{procedimientos.length} {procedimientos.length === 1 ? "procedimiento" : "procedimientos"}</div>
        </div>
      )}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editTarget ? "Editar procedimiento" : "Nuevo procedimiento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label htmlFor="proc-titulo">Título *</Label><Input id="proc-titulo" placeholder="Ej: Procedimiento de calibración de balanzas" value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="proc-desc">Descripción</Label><Textarea id="proc-desc" placeholder="Descripción del procedimiento..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} /></div>
            <div className="space-y-1.5">
              <Label>Archivo</Label>
              {tipos.length > 0 && (
                <>
                  <Select value={tipoDoc} onValueChange={v => { setTipoDoc(v); setCodigoNum(""); }}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Tipo de documento..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin código asignado</SelectItem>
                      {tipos.map(t => (
                        <SelectItem key={t.id} value={t.prefijo}>
                          <span className="font-mono font-medium text-xs mr-2 text-blue-600">{t.prefijo}</span>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {tipoDoc !== "__none__" && (
                    <CodigoDocumentoInput
                      prefijo={tipoDoc}
                      value={codigoNum}
                      onChange={setCodigoNum}
                      disabled={saving}
                    />
                  )}
                </>
              )}
              <div className="flex items-center gap-3">
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => { setPendingFile(e.target.files?.[0] ?? null); }} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4 mr-1.5" />{pendingFile ? "Cambiar archivo" : "Seleccionar archivo"}</Button>
                {pendingFile && <span className="text-xs text-muted-foreground truncate max-w-[180px]">{pendingFile.name}</span>}
                {!pendingFile && editTarget?.archivo_nombre && <span className="text-xs text-muted-foreground">Actual: {editTarget.archivo_nombre}</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !titulo.trim()}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}{editTarget ? "Guardar cambios" : "Crear procedimiento"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Eliminar procedimiento</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground py-2">¿Estás seguro de que querés eliminar <span className="font-medium text-foreground">{deleteTarget?.titulo}</span>? Esta acción no se puede deshacer.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
