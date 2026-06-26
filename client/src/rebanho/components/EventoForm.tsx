import { useEffect, useMemo, useState } from "react";
import { registrarEvento, registrarEventoSanidade, listarRacas, type EventoPayload, type EventoSanidadePayload, type RacaDTO } from "../api";
import { ESPECIE_POR_CATEGORIA, type Animal } from "../types";
import { FRACOES, complementoLabel, montarRacaDisplay } from "../lib/sangue";

const TIPOS: { v: EventoPayload["tipo"]; label: string }[] = [
  { v: "CIO", label: "Cio" }, { v: "INSEMINACAO", label: "Inseminação" }, { v: "DIAGNOSTICO", label: "Diagnóstico" }, { v: "PARTO", label: "Parto" }, { v: "SECAGEM", label: "Secagem" },
];

const TIPOS_SAN: { v: EventoSanidadePayload["tipo"]; label: string }[] = [
  { v: "OCORRENCIA", label: "Ocorrência" }, { v: "APLICACAO", label: "Aplicação" }, { v: "EXAME", label: "Exame" }, { v: "MASTITE", label: "Mastite" }, { v: "VACINA", label: "Vacina" },
];

// Protocolos reprodutivos comuns no manejo leiteiro brasileiro (IATF + monta).
const PROTOCOLOS = [
  "IATF 11 dias", "IATF 9 dias", "IATF 8 dias",
  "Ressincronização (Resynch)", "Ovsynch", "Cosynch", "PreSynch",
  "Cio natural (IA convencional)", "Monta natural", "Repasse com touro",
];

// Motivos típicos para secagem da vaca.
const MOTIVOS_SECAGEM = [
  "Fim de ciclo (60d pré-parto)", "Baixa produção", "Mastite crônica",
  "Preparo para descarte", "CCS elevada persistente", "Decisão de manejo",
];

// Como o cio foi detectado — substitui a observação solta sobre detecção.
const DETECCAO_CIO = [
  "Visual (curral / pasto)", "Coleira / colar (sensor)", "Podômetro",
  "Bastão marcador", "Touro rufião", "Pintura / cera",
];

const TIPOS_PARTO = [
  { v: "normal", label: "Normal" },
  { v: "distocia", label: "Distocia" },
  { v: "cesarea", label: "Cesárea" },
];

const QUARTOS_UBERE = ["AD", "AE", "PD", "PE"]; // anterior/posterior · direito/esquerdo

const SEVERIDADES_MASTITE = ["Subclínica", "Clínica leve", "Clínica moderada", "Clínica grave"];

export function EventoForm({ animalId, animal, onFechar, onSalvo }: { animalId: string; animal?: Animal; onFechar: () => void; onSalvo: () => void }) {
  const [dominio, setDominio] = useState<"reproducao" | "sanidade">("reproducao");
  const [tipo, setTipo] = useState<EventoPayload["tipo"]>("INSEMINACAO");
  const [tipoSan, setTipoSan] = useState<EventoSanidadePayload["tipo"]>("EXAME");
  const [racas, setRacas] = useState<RacaDTO[]>([]);
  const [f, setF] = useState<any>({
    data: "",
    // Reprodutor estruturado (raça + grau de sangue).
    racaReprodutorId: "", fracaoReprodutor: "8/8", racaSecReprodutorId: "",
    protocolo: PROTOCOLOS[0], protocoloOutro: "",
    deteccaoCio: DETECCAO_CIO[0],
    resultado: "positivo", dtPartoPrevista: "",
    numCrias: "1", sexoCria: "F", tipoParto: "normal",
    motivoSecagem: MOTIVOS_SECAGEM[0],
    observacao: "",
    // Sanidade.
    doenca: "", diasTratamento: "", produto: "", dose: "", carencia: "", loteProduto: "",
    ccs: "", gordura: "", proteina: "",
    quarto: QUARTOS_UBERE[0], severidade: SEVERIDADES_MASTITE[0], resultadoCultivo: "",
  });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k: string, v: string) => setF((s: any) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() !== "" ? Number(v) : undefined);

  useEffect(() => { listarRacas().then(setRacas).catch(() => {}); }, []);

  // Espécie da fêmea — filtra raças do reprodutor pra mesma espécie.
  const especie = animal ? ESPECIE_POR_CATEGORIA[animal.categoria] : null;
  const racasDaEspecie = useMemo(
    () => (especie ? racas.filter((r) => r.especie === especie) : racas),
    [racas, especie],
  );

  const racaReprodutor = racas.find((r) => String(r.id) === f.racaReprodutorId);
  const racaSecReprodutor = racas.find((r) => String(r.id) === f.racaSecReprodutorId);
  const opcoesSecReprodutor = racaReprodutor
    ? racas.filter((r) => r.especie === racaReprodutor.especie && r.id !== racaReprodutor.id)
    : [];
  const ehPuroRep = f.fracaoReprodutor === "8/8";
  const fracCompRep = complementoLabel(f.fracaoReprodutor);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (dominio === "reproducao") {
        const p: EventoPayload = { tipo, data: f.data, observacao: f.observacao || undefined };
        if (tipo === "CIO") {
          // Detecção entra como observação curta — o backend não tem campo dedicado.
          p.observacao = [f.deteccaoCio, f.observacao].filter(Boolean).join(" · ") || undefined;
        }
        if (tipo === "INSEMINACAO") {
          const rep = montarRacaDisplay(f.fracaoReprodutor, racaReprodutor, racaSecReprodutor);
          if (!rep) throw new Error("Selecione a raça do reprodutor.");
          p.reprodutor = rep;
          const proto = f.protocolo === "Outro" ? f.protocoloOutro.trim() : f.protocolo;
          p.protocolo = proto || undefined;
        }
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
          {tipo === "CIO" && (
            <label className="rb-fld">Detecção
              <select value={f.deteccaoCio} onChange={(e) => set("deteccaoCio", e.target.value)}>
                {DETECCAO_CIO.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          )}
          {tipo === "INSEMINACAO" && <>
            <label className="rb-fld">Raça do reprodutor*
              <select value={f.racaReprodutorId} onChange={(e) => set("racaReprodutorId", e.target.value)}>
                <option value="">—</option>
                {racasDaEspecie.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </label>
            {racaReprodutor && (
              <fieldset className="rb-fieldset">
                <legend>Grau de sangue</legend>
                <div className="rb-sangue-row">
                  <span className="rb-sangue-raca">{racaReprodutor.nome}</span>
                  <select className="rb-sangue-frac" value={f.fracaoReprodutor} onChange={(e) => set("fracaoReprodutor", e.target.value)} aria-label="Fração da raça principal">
                    {FRACOES.map((fr) => <option key={fr.id} value={fr.id}>{fr.label}</option>)}
                  </select>
                </div>
                {!ehPuroRep && (
                  <div className="rb-sangue-row">
                    <select className="rb-sangue-raca-sec" value={f.racaSecReprodutorId} onChange={(e) => set("racaSecReprodutorId", e.target.value)} aria-label="Raça secundária">
                      <option value="">— escolher raça —</option>
                      {opcoesSecReprodutor.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
                    </select>
                    <span className="rb-sangue-frac-comp">{fracCompRep}</span>
                  </div>
                )}
              </fieldset>
            )}
            <label className="rb-fld">Protocolo
              <select value={f.protocolo} onChange={(e) => set("protocolo", e.target.value)}>
                {PROTOCOLOS.map((p) => <option key={p} value={p}>{p}</option>)}
                <option value="Outro">Outro…</option>
              </select>
            </label>
            {f.protocolo === "Outro" && (
              <label className="rb-fld">Descrever protocolo<input value={f.protocoloOutro} onChange={(e) => set("protocoloOutro", e.target.value)} placeholder="ex.: P36 / FertilizAID" /></label>
            )}
          </>}
          {tipo === "DIAGNOSTICO" && <>
            <label className="rb-fld">Resultado<select value={f.resultado} onChange={(e) => set("resultado", e.target.value)}><option value="positivo">Positivo</option><option value="negativo">Negativo</option></select></label>
            <label className="rb-fld">Parto previsto<input type="date" value={f.dtPartoPrevista} onChange={(e) => set("dtPartoPrevista", e.target.value)} /></label>
          </>}
          {tipo === "PARTO" && <>
            <label className="rb-fld">Nº de crias<input type="number" min={1} max={3} value={f.numCrias} onChange={(e) => set("numCrias", e.target.value)} /></label>
            <label className="rb-fld">Sexo da cria<select value={f.sexoCria} onChange={(e) => set("sexoCria", e.target.value)}><option value="F">Fêmea</option><option value="M">Macho</option><option value="FM">Gemelar</option></select></label>
            <label className="rb-fld">Tipo de parto<select value={f.tipoParto} onChange={(e) => set("tipoParto", e.target.value)}>{TIPOS_PARTO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></label>
          </>}
          {tipo === "SECAGEM" && (
            <label className="rb-fld">Motivo
              <select value={f.motivoSecagem} onChange={(e) => set("motivoSecagem", e.target.value)}>
                {MOTIVOS_SECAGEM.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
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
            <label className="rb-fld">Quarto
              <select value={f.quarto} onChange={(e) => set("quarto", e.target.value)}>
                {QUARTOS_UBERE.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </label>
            <label className="rb-fld">Severidade
              <select value={f.severidade} onChange={(e) => set("severidade", e.target.value)}>
                {SEVERIDADES_MASTITE.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="rb-fld">Resultado do cultivo<input value={f.resultadoCultivo} onChange={(e) => set("resultadoCultivo", e.target.value)} placeholder="ex.: Staphylococcus aureus" /></label>
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
