import { useState } from "react";
import type { Talhao, TipoOperacao, PragaDoenca } from "../types";
import { registrarOperacao, type OperacaoInput } from "../api";
import { HOJE } from "../HOJE";

// Quebra "600 mL/ha" → { valor: 600, unidade: "mL/ha" }. Tolera "2,5 t/ha" (vírgula
// decimal pt-BR) e campos vazios. Retorna {} quando não há número parseável.
function parseDose(s: string): { doseValor?: number; doseUnidade?: string } {
  const txt = s.trim();
  if (!txt) return {};
  const m = txt.match(/^(-?\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { doseUnidade: txt };
  const valor = Number(m[1].replace(",", "."));
  const unidade = m[2].trim();
  return { doseValor: Number.isFinite(valor) ? valor : undefined, doseUnidade: unidade || undefined };
}

const DOMINIOS: { v: "fenologia" | "fitossanidade" | "nutricao" | "colheita"; label: string }[] = [
  { v: "fitossanidade", label: "Fitossanidade" },
  { v: "nutricao", label: "Nutrição / Solo" },
  { v: "fenologia", label: "Fenologia" },
  { v: "colheita", label: "Colheita" },
];

const OP_FITO: { v: TipoOperacao; label: string }[] = [
  { v: "APLICACAO_FUNGICIDA", label: "Aplicação de fungicida" },
  { v: "APLICACAO_INSETICIDA", label: "Aplicação de inseticida" },
  { v: "APLICACAO_HERBICIDA", label: "Aplicação de herbicida" },
  { v: "ROCAGEM_MECANICA", label: "Roçagem mecânica" },
  { v: "CAPINA_MANUAL", label: "Capina manual" },
  { v: "MONITORAMENTO_MIP", label: "Inspeção MIP" },
];

const OP_NUT: { v: TipoOperacao; label: string }[] = [
  { v: "ADUBACAO_SOLO", label: "Adubação de solo (parcelada)" },
  { v: "ADUBACAO_FOLIAR", label: "Adubação foliar" },
  { v: "CALAGEM", label: "Calagem" },
  { v: "GESSAGEM", label: "Gessagem" },
  { v: "AMOSTRAGEM_SOLO", label: "Amostragem de solo" },
  { v: "AMOSTRAGEM_FOLIAR", label: "Amostragem foliar" },
];

const OP_FEN: { v: TipoOperacao; label: string }[] = [
  { v: "PODA_RECEPA", label: "Poda — Recepa (baixa, 30-40 cm)" },
  { v: "PODA_DECOTE", label: "Poda — Decote (1,80-2,40 m)" },
  { v: "PODA_ESQUELETAMENTO", label: "Poda — Esqueletamento" },
  { v: "PODA_DESPONTE", label: "Poda — Desponte" },
  { v: "DESBROTA", label: "Desbrota" },
  { v: "IRRIGACAO", label: "Irrigação" },
  { v: "REPLANTIO", label: "Replantio (falhas)" },
];

const PRAGAS: { v: PragaDoenca; label: string }[] = [
  { v: "FERRUGEM", label: "Ferrugem (Hemileia vastatrix)" },
  { v: "CERCOSPORIOSE", label: "Cercosporiose" },
  { v: "BICHO_MINEIRO", label: "Bicho-mineiro" },
  { v: "BROCA_DO_CAFE", label: "Broca do café" },
  { v: "ACARO_VERMELHO", label: "Ácaro vermelho" },
  { v: "NEMATOIDES", label: "Nematoides" },
  { v: "ANTRACNOSE", label: "Antracnose" },
  { v: "MANCHA_AUREOLADA", label: "Mancha aureolada" },
  { v: "FUMAGINA", label: "Fumagina" },
  { v: "COCHONILHAS", label: "Cochonilhas" },
  { v: "ROSELINIA", label: "Roselínia" },
  { v: "OUTRA", label: "Outra" },
];

export function OperacaoForm({ talhaoId, talhao, dominioFixo, onFechar, onSalvo }: {
  talhaoId: string;
  talhao?: Talhao;
  dominioFixo?: "fenologia" | "fitossanidade" | "nutricao" | "colheita";
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [dominio, setDominio] = useState<"fenologia" | "fitossanidade" | "nutricao" | "colheita">(dominioFixo ?? "fitossanidade");
  const [tipo, setTipo] = useState<TipoOperacao>(OP_FITO[0].v);
  const [data, setData] = useState(HOJE);
  const [praga, setPraga] = useState<PragaDoenca>("FERRUGEM");
  const [produto, setProduto] = useState("");
  const [dose, setDose] = useState("");
  const [volumeCalda, setVolumeCalda] = useState("");
  const [incidencia, setIncidencia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Litros de cereja (colheita)
  const [litrosCereja, setLitrosCereja] = useState("");
  const [rendimentoLsc, setRendimentoLsc] = useState("480");
  const [metodoColheita, setMetodoColheita] = useState<"DERRIÇA_PANO" | "DERRIÇA_MECANIZADA" | "SELETIVA" | "VARRIÇÃO">("DERRIÇA_PANO");

  // NPK (adubação)
  const [nKg, setNKg] = useState("");
  const [pKg, setPKg] = useState("");
  const [kKg, setKKg] = useState("");

  const opcoesTipo = dominio === "fitossanidade" ? OP_FITO
    : dominio === "nutricao" ? OP_NUT
    : dominio === "fenologia" ? OP_FEN
    : ([{ v: "ADUBACAO_SOLO" as TipoOperacao, label: "Colheita registrada na aba dedicada" }]);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      // Detalhes específicos do domínio que não cabem no body canônico do backend
      // (NPK, calda, incidência, colheita) viram notas no campo observação, pra não
      // se perder até existir endpoint dedicado.
      const extras: string[] = [];
      if (dominio === "fitossanidade") {
        if (volumeCalda) extras.push(`Calda ${volumeCalda} L/ha`);
        if (incidencia) extras.push(`Incidência ${incidencia}%`);
      }
      if (dominio === "nutricao" && (tipo === "ADUBACAO_SOLO" || tipo === "ADUBACAO_FOLIAR")) {
        const npk = [nKg && `N ${nKg}`, pKg && `P₂O₅ ${pKg}`, kKg && `K₂O ${kKg}`].filter(Boolean);
        if (npk.length) extras.push(`${npk.join(" · ")} (kg/ha)`);
      }
      if (dominio === "colheita") {
        if (litrosCereja) extras.push(`${litrosCereja} L de cereja (${metodoColheita.replace("_", " ").toLowerCase()})`);
        if (litrosCereja && rendimentoLsc) extras.push(`≈ ${(Number(litrosCereja) / Number(rendimentoLsc)).toFixed(1)} sc · rend. ${rendimentoLsc} L/sc`);
      }
      const obs = [observacao.trim(), ...extras].filter(Boolean).join(" — ") || undefined;

      const { doseValor, doseUnidade } = parseDose(dose);
      await registrarOperacao(talhaoId, {
        // backend espera o enum em maiúsculas (FENOLOGIA/FITOSSANIDADE/NUTRICAO/COLHEITA)
        dominio: dominio.toUpperCase() as OperacaoInput["dominio"], tipo, data,
        responsavel: responsavel.trim() || undefined,
        produto: produto.trim() || undefined,
        observacao: obs,
        doseValor,
        doseUnidade,
        pragaAlvo: dominio === "fitossanidade" ? praga : undefined,
      });
      onSalvo();
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao salvar.");
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog" aria-labelledby="op-title">
        <div className="rb-drawer-head">
          <h3 id="op-title">Registrar operação{talhao ? ` — ${talhao.codigo}` : ""}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>

        <div className="rb-drawer-body">
          {/* Segmented domain selector — espelha o do EventoForm do rebanho. */}
          {!dominioFixo && (
            <div className="rb-seg" style={{ display: "flex", gap: 6, marginBottom: 18 }}>
              {DOMINIOS.map((d) => (
                <button key={d.v} className="rb-btn" aria-pressed={dominio === d.v} onClick={() => { setDominio(d.v); setTipo((d.v === "fitossanidade" ? OP_FITO : d.v === "nutricao" ? OP_NUT : OP_FEN)[0].v); }}>
                  {d.label}
                </button>
              ))}
            </div>
          )}

          <div className="rb-fld">
            <label>Tipo de operação</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoOperacao)}>
              {opcoesTipo.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
          </div>

          <div className="rb-fld">
            <label>Data</label>
            <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          {/* Fitossanidade — praga + produto + calda + incidência observada */}
          {dominio === "fitossanidade" && (
            <>
              <div className="rb-fld">
                <label>Praga/doença alvo</label>
                <select value={praga} onChange={(e) => setPraga(e.target.value as PragaDoenca)}>
                  {PRAGAS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
              {tipo !== "MONITORAMENTO_MIP" && (
                <>
                  <div className="rb-fld">
                    <label>Produto / princípio ativo</label>
                    <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: Ciproconazol + Trifloxistrobina" />
                  </div>
                  <div className="rb-fld">
                    <label>Dose (g ou mL / ha)</label>
                    <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex.: 600 mL/ha" />
                  </div>
                  <div className="rb-fld">
                    <label>Volume de calda (L/ha)</label>
                    <input type="number" value={volumeCalda} onChange={(e) => setVolumeCalda(e.target.value)} placeholder="Ex.: 500" />
                  </div>
                </>
              )}
              <div className="rb-fld">
                <label>Incidência observada (%)</label>
                <input type="number" step="0.1" value={incidencia} onChange={(e) => setIncidencia(e.target.value)} placeholder="Folhas/frutos amostrados" />
              </div>
            </>
          )}

          {/* Nutrição — NPK em kg/ha */}
          {dominio === "nutricao" && (tipo === "ADUBACAO_SOLO" || tipo === "ADUBACAO_FOLIAR") && (
            <>
              <div className="rb-fld">
                <label>Produto / formulado</label>
                <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder="Ex.: 20-00-20 ou Sulfato de amônio" />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div className="rb-fld" style={{ flex: 1 }}>
                  <label>N (kg/ha)</label>
                  <input type="number" value={nKg} onChange={(e) => setNKg(e.target.value)} />
                </div>
                <div className="rb-fld" style={{ flex: 1 }}>
                  <label>P₂O₅ (kg/ha)</label>
                  <input type="number" value={pKg} onChange={(e) => setPKg(e.target.value)} />
                </div>
                <div className="rb-fld" style={{ flex: 1 }}>
                  <label>K₂O (kg/ha)</label>
                  <input type="number" value={kKg} onChange={(e) => setKKg(e.target.value)} />
                </div>
              </div>
            </>
          )}
          {dominio === "nutricao" && (tipo === "CALAGEM" || tipo === "GESSAGEM") && (
            <>
              <div className="rb-fld">
                <label>Produto</label>
                <input value={produto} onChange={(e) => setProduto(e.target.value)} placeholder={tipo === "CALAGEM" ? "Ex.: Calcário dolomítico PRNT 85%" : "Ex.: Gesso agrícola"} />
              </div>
              <div className="rb-fld">
                <label>Dose (t/ha)</label>
                <input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="Ex.: 2,5" />
              </div>
            </>
          )}

          {/* Colheita — litros + rendimento + método */}
          {dominio === "colheita" && (
            <>
              <div className="rb-fld">
                <label>Método</label>
                <select value={metodoColheita} onChange={(e) => setMetodoColheita(e.target.value as any)}>
                  <option value="DERRIÇA_PANO">Derriça no pano</option>
                  <option value="DERRIÇA_MECANIZADA">Derriça mecanizada</option>
                  <option value="SELETIVA">Seletiva (catação)</option>
                  <option value="VARRIÇÃO">Varrição</option>
                </select>
              </div>
              <div className="rb-fld">
                <label>Litros de cereja colhidos</label>
                <input type="number" value={litrosCereja} onChange={(e) => setLitrosCereja(e.target.value)} placeholder="Medido no campo" />
              </div>
              <div className="rb-fld">
                <label>Rendimento (L/saca)</label>
                <input type="number" value={rendimentoLsc} onChange={(e) => setRendimentoLsc(e.target.value)} placeholder="Típico 480–520" />
              </div>
              {litrosCereja && rendimentoLsc && (
                <p className="rb-sub">
                  Saída estimada: <b>{(Number(litrosCereja) / Number(rendimentoLsc)).toFixed(1)} sc</b> beneficiadas.
                </p>
              )}
            </>
          )}

          <div className="rb-fld">
            <label>Responsável</label>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem executou" />
          </div>

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
          </div>

          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
