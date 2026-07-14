import { useEffect, useState } from "react";
import type { Talhao } from "../types";
import { criarTalhao, editarTalhao, darBaixa, listarVariedades, useLavouras, type VariedadeDTO, type TalhaoInput } from "../api";
import { HOJE } from "../HOJE";
import { RebModal } from "@/components/rb/RebModal";
import { RebButton } from "@/components/rb/RebButton";
import { RebField } from "@/components/rb/RebField";

export function TalhaoForm({ modo, talhao, onFechar, onSalvo }: { modo: "novo" | "editar" | "baixa"; talhao?: Talhao; onFechar: () => void; onSalvo: () => void }) {
  const t = talhao;
  const { data: lavouras } = useLavouras();
  const [variedades, setVariedades] = useState<VariedadeDTO[]>([]);

  const [codigo, setCodigo] = useState(t?.codigo ?? "");
  const [nome, setNome] = useState(t?.nome ?? "");
  const [variedadeId, setVariedadeId] = useState<string>("");
  const [lavouraId, setLavouraId] = useState<string>("");
  const [areaHa, setAreaHa] = useState<string>(String(t?.areaHa ?? ""));
  const [espRua, setEspRua] = useState<string>(t?.espacamento?.split("×")[0]?.trim().replace(",", ".").replace(" m", "") ?? "3.80");
  const [espPe, setEspPe] = useState<string>(t?.espacamento?.split("×")[1]?.trim().replace(",", ".").replace(" m", "") ?? "0.60");
  const [anoPlantio, setAnoPlantio] = useState<string>(String(t?.anoPlantio ?? new Date().getFullYear()));
  const [altitude, setAltitude] = useState<string>(String(t?.altitude ?? "1000"));
  const [exposicao, setExposicao] = useState<string>(t?.exposicao ?? "");
  const [declive, setDeclive] = useState<string>(t?.declive != null ? String(t.declive) : "");
  const [irrigado, setIrrigado] = useState<boolean>(!!t?.irrigado);
  const [dataPlantio, setDataPlantio] = useState<string>(t?.dataPlantio ?? "");
  const [motivoBaixa, setMotivoBaixa] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarVariedades().then((vs) => {
      setVariedades(vs);
      // Ao editar, casa o nome da variedade do talhão de volta no id correspondente.
      if (t?.variedade) {
        const m = vs.find((v) => v.nome === t.variedade);
        if (m) setVariedadeId(String(m.id));
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ao editar, casa o nome da lavoura do talhão de volta no id correspondente.
  useEffect(() => {
    if (t?.lavoura && lavouras.length && !lavouraId) {
      const m = lavouras.find((l) => l.nome === t.lavoura);
      if (m) setLavouraId(String(m.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lavouras]);

  const plantasHa = (() => {
    const r = parseFloat(espRua); const p = parseFloat(espPe);
    if (!r || !p) return 0;
    return Math.round(10000 / (r * p));
  })();

  const titulo = modo === "novo" ? "Novo talhão" : modo === "editar" ? `Editar ${t?.codigo}` : `Baixar ${t?.codigo}`;

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      if (modo === "baixa" && t) {
        await darBaixa(t.id, { motivo: motivoBaixa });
      } else {
        const payload: TalhaoInput = {
          codigo,
          nome: nome || undefined,
          variedadeId: Number(variedadeId),
          lavouraId: lavouraId ? Number(lavouraId) : undefined,
          espacamento: `${espRua.replace(".", ",")} × ${espPe.replace(".", ",")} m`,
          plantasHa,
          areaHa: Number(areaHa),
          anoPlantio: Number(anoPlantio),
          altitude: altitude ? Number(altitude) : undefined,
          exposicao: exposicao || null,
          declive: declive ? Number(declive) : null,
          irrigado,
          dataPlantio: dataPlantio || `${anoPlantio}-01-01`,
        };
        if (modo === "novo") await criarTalhao(payload);
        else if (t) await editarTalhao(t.id, payload);
      }
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  if (modo === "baixa") {
    return (
      <RebModal
        title={`Dar baixa em ${t?.codigo}`}
        onClose={onFechar}
        actions={
          <>
            <RebButton onClick={onFechar}>Cancelar</RebButton>
            <RebButton variant="danger" disabled={!motivoBaixa || salvando} onClick={salvar}>{salvando ? "Salvando…" : "Confirmar baixa"}</RebButton>
          </>
        }
      >
        <p className="text-sm text-ink-3">O talhão sai do conjunto ativo. Mantém histórico para fins contábeis.</p>
        <RebField label="Motivo">
          <select className="rb-field-select" value={motivoBaixa} onChange={(e) => setMotivoBaixa(e.target.value)}>
            <option value="">Selecione…</option>
            <option>Erradicação (lavoura exausta)</option>
            <option>Conversão para pasto</option>
            <option>Conversão para outra cultura</option>
            <option>Geada severa</option>
            <option>Desapropriação / venda</option>
            <option>Outro</option>
          </select>
        </RebField>
        {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </RebModal>
    );
  }

  return (
    <RebModal
      title={titulo}
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !codigo || !areaHa || !variedadeId} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <>
          <div style={{ display: "flex", gap: 10 }}>
            <RebField label="Código*" style={{ flex: 1 }}>
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: CAF-12" />
            </RebField>
            <RebField label="Nome" style={{ flex: 2 }}>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Cafundó alto · setor 4" />
            </RebField>
          </div>

          <RebField label="Variedade*">
            <select className="rb-field-select" value={variedadeId} onChange={(e) => setVariedadeId(e.target.value)}>
              <option value="">Selecione…</option>
              {variedades.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </RebField>

          <RebField label="Lavoura (agrupador)">
            <select className="rb-field-select" value={lavouraId} onChange={(e) => setLavouraId(e.target.value)}>
              <option value="">—</option>
              {lavouras.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
            </select>
          </RebField>

          <div style={{ display: "flex", gap: 10 }}>
            <RebField label="Área (ha)*" style={{ flex: 1 }}>
              <input type="number" step="0.1" value={areaHa} onChange={(e) => setAreaHa(e.target.value)} />
            </RebField>
            <RebField label="Ano de plantio*" style={{ flex: 1 }}>
              <input type="number" value={anoPlantio} onChange={(e) => setAnoPlantio(e.target.value)} />
            </RebField>
            <RebField label="Altitude (m)" style={{ flex: 1 }}>
              <input type="number" value={altitude} onChange={(e) => setAltitude(e.target.value)} />
            </RebField>
          </div>

          <RebField label="Data de plantio*">
            <input type="date" value={dataPlantio} onChange={(e) => setDataPlantio(e.target.value)} max={HOJE} />
          </RebField>

          <fieldset style={{ border: "1px solid var(--rule)", borderRadius: 8, padding: 12, margin: "10px 0" }}>
            <legend style={{ fontSize: 13, color: "var(--ink-3)", padding: "0 6px" }}>Espaçamento</legend>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <RebField label="Rua (m)" style={{ flex: 1, marginBottom: 0 }}>
                <input type="number" step="0.1" value={espRua} onChange={(e) => setEspRua(e.target.value)} />
              </RebField>
              <div style={{ alignSelf: "center", padding: "0 10px", color: "var(--ink-3)" }}>×</div>
              <RebField label="Pé (m)" style={{ flex: 1, marginBottom: 0 }}>
                <input type="number" step="0.05" value={espPe} onChange={(e) => setEspPe(e.target.value)} />
              </RebField>
              <div style={{ alignSelf: "center", padding: "0 10px", whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                = <b>{plantasHa.toLocaleString("pt-BR")}</b> pl/ha
              </div>
            </div>
          </fieldset>

          <div style={{ display: "flex", gap: 10 }}>
            <RebField label="Exposição" style={{ flex: 1 }}>
              <select className="rb-field-select" value={exposicao} onChange={(e) => setExposicao(e.target.value)}>
                <option value="">—</option>
                <option value="norte">norte</option>
                <option value="sul">sul</option>
                <option value="leste">leste</option>
                <option value="oeste">oeste</option>
              </select>
            </RebField>
            <RebField label="Declive (%)" style={{ flex: 1 }}>
              <input type="number" value={declive} onChange={(e) => setDeclive(e.target.value)} />
            </RebField>
            <RebField style={{ flex: 1, alignSelf: "flex-end" }}>
              <label>
                <input type="checkbox" checked={irrigado} onChange={(e) => setIrrigado(e.target.checked)} /> Irrigado
              </label>
            </RebField>
          </div>
          {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
      </>
    </RebModal>
  );
}
