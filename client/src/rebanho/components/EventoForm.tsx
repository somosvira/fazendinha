import { useState } from "react";
import { registrarEvento, type EventoPayload } from "../api";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" },
];

export function EventoForm({ animalId, onFechar, onSalvo }: { animalId: string; onFechar: () => void; onSalvo: () => void }) {
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>("INSEMINACAO");
  const [f, setF] = useState<any>({ data: "", reprodutor: "", protocolo: "", resultado: "positivo", dtPartoPrevista: "", numCrias: "1", sexoCria: "F", tipoParto: "normal", motivoSecagem: "", observacao: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
      if (tipo === "INSEMINACAO") { p.reprodutor = f.reprodutor; p.protocolo = f.protocolo || undefined; }
      if (tipo === "DIAGNOSTICO") { p.resultado = f.resultado; p.dtPartoPrevista = f.dtPartoPrevista || undefined; }
      if (tipo === "PARTO") { p.numCrias = Number(f.numCrias); p.sexoCria = f.sexoCria; p.tipoParto = f.tipoParto; }
      if (tipo === "SECAGEM") p.motivoSecagem = f.motivoSecagem || undefined;
      await registrarEvento(animalId, p);
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Registrar evento</h3>
        <label className="rb-fld">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
        <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
        {tipo === "INSEMINACAO" && <>
          <label className="rb-fld">Reprodutor / sêmen*<input value={f.reprodutor} onChange={(e) => set("reprodutor", e.target.value)} /></label>
          <label className="rb-fld">Protocolo<input value={f.protocolo} onChange={(e) => set("protocolo", e.target.value)} placeholder="IATF 11d" /></label>
        </>}
        {tipo === "DIAGNOSTICO" && <>
          <label className="rb-fld">Resultado<select value={f.resultado} onChange={(e) => set("resultado", e.target.value)}><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></label>
          <label className="rb-fld">Parto previsto<input type="date" value={f.dtPartoPrevista} onChange={(e) => set("dtPartoPrevista", e.target.value)} /></label>
        </>}
        {tipo === "PARTO" && <>
          <label className="rb-fld">Nº de crias<input type="number" min={1} max={3} value={f.numCrias} onChange={(e) => set("numCrias", e.target.value)} /></label>
          <label className="rb-fld">Sexo da cria<select value={f.sexoCria} onChange={(e) => set("sexoCria", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option><option value="FM">Gemelar</option></select></label>
          <label className="rb-fld">Tipo de parto<select value={f.tipoParto} onChange={(e) => set("tipoParto", e.target.value)}><option value="normal">Normal</option><option value="distocia">Distocia</option><option value="cesarea">Cesárea</option></select></label>
        </>}
        {tipo === "SECAGEM" && <label className="rb-fld">Motivo<input value={f.motivoSecagem} onChange={(e) => set("motivoSecagem", e.target.value)} placeholder="fim de ciclo" /></label>}
        <label className="rb-fld">Observação<input value={f.observacao} onChange={(e) => set("observacao", e.target.value)} /></label>
        {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
