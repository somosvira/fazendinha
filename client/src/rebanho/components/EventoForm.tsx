import { useState } from "react";
import { registrarEvento, registrarEventoSanidade, type EventoPayload, type EventoSanidadePayload } from "../api";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" },
];

const TIPOS_SAN: { v: EventoSanidadePayload["tipo"]; label: string }[] = [
  { v: "OCORRENCIA", label: "Ocorrência" }, { v: "APLICACAO", label: "Aplicação" }, { v: "EXAME", label: "Exame" }, { v: "MASTITE", label: "Mastite" }, { v: "VACINA", label: "Vacina" },
];

export function EventoForm({ animalId, onFechar, onSalvo }: { animalId: string; onFechar: () => void; onSalvo: () => void }) {
  const [dominio, setDominio] = useState<"reproducao" | "sanidade">("reproducao");
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>("INSEMINACAO");
  const [tipoSan, setTipoSan] = useState<EventoSanidadePayload["tipo"]>("EXAME");
  const [f, setF] = useState<any>({ data: "", reprodutor: "", protocolo: "", resultado: "positivo", dtPartoPrevista: "", numCrias: "1", sexoCria: "F", tipoParto: "normal", motivoSecagem: "", observacao: "", doenca: "", diasTratamento: "", produto: "", dose: "", carencia: "", loteProduto: "", ccs: "", gordura: "", proteina: "", quarto: "", severidade: "", resultadoCultivo: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (dominio === "reproducao") {
        const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
        if (tipo === "INSEMINACAO") { p.reprodutor = f.reprodutor; p.protocolo = f.protocolo || undefined; }
        if (tipo === "DIAGNOSTICO") { p.resultado = f.resultado; p.dtPartoPrevista = f.dtPartoPrevista || undefined; }
        if (tipo === "PARTO") { p.numCrias = Number(f.numCrias); p.sexoCria = f.sexoCria; p.tipoParto = f.tipoParto; }
        if (tipo === "SECAGEM") p.motivoSecagem = f.motivoSecagem || undefined;
        await registrarEvento(animalId, p);
      } else {
        const p: EventoSanidadePayload = { tipo: tipoSan, data: f.data, observacao: f.observacao || undefined };
        if (tipoSan === "EXAME") { p.ccs = num(f.ccs); p.gordura = num(f.gordura); p.proteina = num(f.proteina); }
        if (tipoSan === "APLICACAO") { p.produto = f.produto; p.dose = f.dose || undefined; p.carencia = num(f.carencia); p.loteProduto = f.loteProduto || undefined; }
        if (tipoSan === "OCORRENCIA") { p.doenca = f.doenca; p.diasTratamento = num(f.diasTratamento); }
        if (tipoSan === "MASTITE") { p.quarto = f.quarto || undefined; p.severidade = f.severidade || undefined; p.resultadoCultivo = f.resultadoCultivo || undefined; }
        if (tipoSan === "VACINA") p.produto = f.produto;
        await registrarEventoSanidade(animalId, p);
      }
      onSalvo();
    } catch (e: any) { setErro(e.message); } finally { setSalvando(false); }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer">
        <h3>Registrar evento</h3>
        <label className="rb-fld">Domínio<select value={dominio} onChange={(e) => setDominio(e.target.value as any)}><option value="reproducao">Reprodução</option><option value="sanidade">Sanidade</option></select></label>
        {dominio === "reproducao"
          ? <label className="rb-fld">Tipo<select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>{TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
          : <label className="rb-fld">Tipo<select value={tipoSan} onChange={(e) => setTipoSan(e.target.value as any)}>{TIPOS_SAN.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>}
        <label className="rb-fld">Data*<input type="date" value={f.data} onChange={(e) => set("data", e.target.value)} /></label>
        {dominio === "reproducao" && <>
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
        </>}
        {dominio === "sanidade" && <>
          {tipoSan === "EXAME" && <>
            <label className="rb-fld">CCS (mil)*<input type="number" min={0} value={f.ccs} onChange={(e) => set("ccs", e.target.value)} /></label>
            <label className="rb-fld">Gordura (%)<input type="number" step="0.01" value={f.gordura} onChange={(e) => set("gordura", e.target.value)} /></label>
            <label className="rb-fld">Proteína (%)<input type="number" step="0.01" value={f.proteina} onChange={(e) => set("proteina", e.target.value)} /></label>
          </>}
          {tipoSan === "APLICACAO" && <>
            <label className="rb-fld">Produto*<input value={f.produto} onChange={(e) => set("produto", e.target.value)} placeholder="Mastijet" /></label>
            <label className="rb-fld">Dose<input value={f.dose} onChange={(e) => set("dose", e.target.value)} placeholder="1 bisnaga" /></label>
            <label className="rb-fld">Carência (h)<input type="number" min={0} value={f.carencia} onChange={(e) => set("carencia", e.target.value)} /></label>
            <label className="rb-fld">Lote do produto<input value={f.loteProduto} onChange={(e) => set("loteProduto", e.target.value)} placeholder="MAST-2231" /></label>
          </>}
          {tipoSan === "OCORRENCIA" && <>
            <label className="rb-fld">Doença*<input value={f.doenca} onChange={(e) => set("doenca", e.target.value)} placeholder="Mastite clínica" /></label>
            <label className="rb-fld">Dias de tratamento<input type="number" min={0} value={f.diasTratamento} onChange={(e) => set("diasTratamento", e.target.value)} /></label>
          </>}
          {tipoSan === "MASTITE" && <>
            <label className="rb-fld">Quarto<input value={f.quarto} onChange={(e) => set("quarto", e.target.value)} placeholder="PD" /></label>
            <label className="rb-fld">Severidade<input value={f.severidade} onChange={(e) => set("severidade", e.target.value)} placeholder="clínica" /></label>
            <label className="rb-fld">Resultado do cultivo<input value={f.resultadoCultivo} onChange={(e) => set("resultadoCultivo", e.target.value)} /></label>
          </>}
          {tipoSan === "VACINA" && <label className="rb-fld">Produto*<input value={f.produto} onChange={(e) => set("produto", e.target.value)} /></label>}
        </>}
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
