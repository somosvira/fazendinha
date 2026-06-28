import { useState } from "react";
import type { Talhao, VariedadeCafe } from "../types";

const VARIEDADES: VariedadeCafe[] = [
  "Catuaí Vermelho IAC 144", "Catuaí Amarelo IAC 144", "Catuaí Amarelo IAC 62",
  "Catuaí Vermelho IAC 99", "Catuaí Vermelho IAC 81",
  "Mundo Novo IAC 379-19", "Mundo Novo IAC 502-9",
  "Topázio MG-1190", "Acauã", "Acauã Novo",
  "Bourbon Amarelo", "Icatu", "Arara", "Asa Branca", "Paraíso MG H 419-1",
];

export function TalhaoForm({ modo, talhao, onFechar, onSalvo }: { modo: "novo" | "editar" | "baixa"; talhao?: Talhao; onFechar: () => void; onSalvo: () => void }) {
  const t = talhao;
  const [codigo, setCodigo] = useState(t?.codigo ?? "");
  const [nome, setNome] = useState(t?.nome ?? "");
  const [variedade, setVariedade] = useState<VariedadeCafe>(t?.variedade ?? "Catuaí Vermelho IAC 144");
  const [lavoura, setLavoura] = useState(t?.lavoura ?? "");
  const [areaHa, setAreaHa] = useState<string>(String(t?.areaHa ?? ""));
  const [espRua, setEspRua] = useState<string>(t?.espacamento?.split("×")[0]?.trim().replace(",", ".").replace(" m", "") ?? "3.80");
  const [espPe, setEspPe] = useState<string>(t?.espacamento?.split("×")[1]?.trim().replace(",", ".").replace(" m", "") ?? "0.60");
  const [anoPlantio, setAnoPlantio] = useState<string>(String(t?.anoPlantio ?? new Date().getFullYear()));
  const [altitude, setAltitude] = useState<string>(String(t?.altitude ?? "1000"));
  const [exposicao, setExposicao] = useState<string>(t?.exposicao ?? "");
  const [declive, setDeclive] = useState<string>(String(t?.declive ?? ""));
  const [irrigado, setIrrigado] = useState<boolean>(!!t?.irrigado);
  const [motivoBaixa, setMotivoBaixa] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const plantasHa = (() => {
    const r = parseFloat(espRua); const p = parseFloat(espPe);
    if (!r || !p) return 0;
    return Math.round(10000 / (r * p));
  })();

  const titulo = modo === "novo" ? "Novo talhão" : modo === "editar" ? `Editar ${t?.codigo}` : `Baixar ${t?.codigo}`;

  async function salvar() {
    setSalvando(true);
    const payload = {
      codigo, nome, variedade, lavoura, areaHa: Number(areaHa), espacamento: `${espRua.replace(".", ",")} × ${espPe.replace(".", ",")} m`,
      plantasHa, anoPlantio: Number(anoPlantio), altitude: Number(altitude),
      exposicao: exposicao || null, declive: declive ? Number(declive) : null, irrigado,
      motivoBaixa: modo === "baixa" ? motivoBaixa : undefined,
    };
    await new Promise((r) => setTimeout(r, 250));
    console.log("[plantio] payload talhão:", payload);
    onSalvo();
  }

  if (modo === "baixa") {
    return (
      <>
        <div className="rb-drawer-bg" onClick={onFechar} />
        <aside className="rb-drawer" role="dialog">
          <div className="rb-drawer-head">
            <h3>Dar baixa em {t?.codigo}</h3>
            <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
          </div>
          <div className="rb-drawer-body">
            <p className="rb-sub">O talhão sai do conjunto ativo. Mantém histórico para fins contábeis.</p>
            <div className="rb-fld">
              <label>Motivo</label>
              <select value={motivoBaixa} onChange={(e) => setMotivoBaixa(e.target.value)}>
                <option value="">Selecione…</option>
                <option>Erradicação (lavoura exausta)</option>
                <option>Conversão para pasto</option>
                <option>Conversão para outra cultura</option>
                <option>Geada severa</option>
                <option>Desapropriação / venda</option>
                <option>Outro</option>
              </select>
            </div>
          </div>
          <div className="rb-drawer-actions">
            <button className="rb-btn" onClick={onFechar}>Cancelar</button>
            <button className="rb-btn rb-btn-danger" disabled={!motivoBaixa || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>{titulo}</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Código*</label>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: CAF-12" />
            </div>
            <div className="rb-fld" style={{ flex: 2 }}>
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cafundó alto · setor 4" />
            </div>
          </div>

          <div className="rb-fld">
            <label>Variedade*</label>
            <select value={variedade} onChange={(e) => setVariedade(e.target.value as VariedadeCafe)}>
              {VARIEDADES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          <div className="rb-fld">
            <label>Lavoura (agrupador)</label>
            <input value={lavoura} onChange={(e) => setLavoura(e.target.value)} placeholder="Ex.: Cafundó" />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Área (ha)*</label>
              <input type="number" step="0.1" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Ano de plantio*</label>
              <input type="number" value={anoPlantio} onChange={(e) => setAnoPlantio(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Altitude (m)</label>
              <input type="number" value={altitude} onChange={(e) => setAltitude(e.target.value)} />
            </div>
          </div>

          <fieldset style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 12, margin: "10px 0" }}>
            <legend style={{ fontSize: 13, color: "var(--ink-3)", padding: "0 6px" }}>Espaçamento</legend>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div className="rb-fld" style={{ flex: 1, marginBottom: 0 }}>
                <label>Rua (m)</label>
                <input type="number" step="0.1" value={espRua} onChange={(e) => setEspRua(e.target.value)} />
              </div>
              <div style={{ alignSelf: "center", padding: "0 10px", color: "var(--ink-3)" }}>×</div>
              <div className="rb-fld" style={{ flex: 1, marginBottom: 0 }}>
                <label>Pé (m)</label>
                <input type="number" step="0.05" value={espPe} onChange={(e) => setEspPe(e.target.value)} />
              </div>
              <div style={{ alignSelf: "center", padding: "0 10px", whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                = <b>{plantasHa.toLocaleString("pt-BR")}</b> pl/ha
              </div>
            </div>
          </fieldset>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Exposição</label>
              <select value={exposicao} onChange={(e) => setExposicao(e.target.value)}>
                <option value="">—</option>
                <option value="norte">norte</option>
                <option value="sul">sul</option>
                <option value="leste">leste</option>
                <option value="oeste">oeste</option>
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Declive (%)</label>
              <input type="number" value={declive} onChange={(e) => setDeclive(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1, alignSelf: "flex-end" }}>
              <label>
                <input type="checkbox" checked={irrigado} onChange={(e) => setIrrigado(e.target.checked)} /> Irrigado
              </label>
            </div>
          </div>
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !codigo || !areaHa} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
