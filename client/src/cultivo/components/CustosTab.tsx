import { useState } from "react";
import { Loader } from "../../components/Loading";
import {
  useSafrasCultivo,
  useLancamentosCusto,
  useAreasCultivo,
  criarLancamentoCusto,
  excluirLancamentoCusto,
  type LancamentoCustoInput,
} from "../api";
import type { TipoCustoCultivo, ClassificacaoCategoria } from "../types";
import { ClasseToggle, type Classe } from "../../components/ClasseToggle";
import { HOJE } from "../HOJE";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebModal } from "@/components/rb/RebModal";
import { RebField } from "@/components/rb/RebField";
import { RebMain, RebEmpty, RebAnm, RebPill } from "@/components/rb/RebPrimitives";
import { fmtMoneyExact } from "@/components/charts";

const money = fmtMoneyExact;

// Reproduz .rb-k para células custom (borda colorida / fonte custom).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

const TIPO_LABEL: Record<TipoCustoCultivo, string> = {
  ADUBACAO: "Adubação",
  PREPARO_SOLO: "Preparo de solo",
  PLANTIO: "Plantio",
  TRATOS: "Tratos culturais",
  COLHEITA: "Colheita",
  TRANSPORTE: "Transporte",
  MAO_DE_OBRA: "Mão de obra",
  MAQUINA: "Máquina",
  OUTRO: "Outro",
};
const TIPOS: TipoCustoCultivo[] = ["ADUBACAO", "PREPARO_SOLO", "PLANTIO", "TRATOS", "COLHEITA", "TRANSPORTE", "MAO_DE_OBRA", "MAQUINA", "OUTRO"];

/* Lista + cadastro de LancamentoCusto (balde de custo da safra/área do milho).
 * Espelha o padrão de tab+form inline do CustoTab/EstoqueTab do plantio —
 * aqui o cadastro fica na própria tab (drawer) porque não há cockpit dedicado. */
export function CustosTab() {
  const { data: safras } = useSafrasCultivo();
  const [safraCultivoId, setSafraCultivoId] = useState<number | "">("");
  const [classe, setClasse] = useState<Classe>("tudo");
  const { data, loading, erro, recarregar } = useLancamentosCusto({
    safraCultivoId: safraCultivoId === "" ? undefined : safraCultivoId,
    classe,
  });
  const [form, setForm] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const total = data.reduce((a, l) => a + l.valor, 0);
  const horasTotais = data.reduce((a, l) => a + (l.horasMaquina ?? 0), 0);

  async function excluir(id: number) {
    setExcluindoId(id);
    try {
      await excluirLancamentoCusto(id);
      recarregar();
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Cultivo · milho" title="Lançar custos" />

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <ToolbarSelect
          value={String(safraCultivoId)}
          onChange={(v) => setSafraCultivoId(v ? Number(v) : "")}
          ariaLabel="Filtrar por safra"
          options={[
            { value: "", label: "Todas as safras" },
            ...safras.map((s) => ({ value: String(s.id), label: `${s.nome} · ${s.ano}` })),
          ]}
        />
        <ClasseToggle value={classe} onChange={setClasse} />
        <RebButton variant="pri" style={{ marginLeft: "auto" }} disabled={!safraCultivoId} onClick={() => setForm(true)}>
          + Lançar custo
        </RebButton>
      </div>
      {!safraCultivoId && <p className="text-sm text-ink-3">Selecione uma safra para lançar um novo custo.</p>}

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar custos: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : (
        <>
          <RebKpiStrip cols={3}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Total lançado</div>
              <div className={RB_K_VAL} style={{ fontSize: 26, color: "var(--cafe)" }}>{money(total)}</div>
              <div className={RB_K_D}>{data.length} {data.length === 1 ? "lançamento" : "lançamentos"}</div>
            </div>
            <RebKpi lab="Horas-máquina" val={<>{horasTotais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></>} />
            <div className={RB_K}>
              <div className={RB_K_LAB}>Classe</div>
              <div className={RB_K_VAL} style={{ fontSize: 18 }}>{classe === "tudo" ? "custeio + investimento" : classe}</div>
            </div>
          </RebKpiStrip>

          {data.length === 0 ? (
            <RebEmpty>Nenhum lançamento de custo encontrado.</RebEmpty>
          ) : (
            <RebTable>
              <thead>
                <tr>
                  <th>Data</th><th>Tipo</th><th>Classe</th><th>Descrição</th><th>Área</th>
                  <th>Valor</th><th>H-máquina</th><th>Nº máquinas</th><th>Nº caminhões</th><th />
                </tr>
              </thead>
              <tbody>
                {data.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.data).toLocaleDateString("pt-BR")}</td>
                    <td><RebAnm>{TIPO_LABEL[l.tipo]}</RebAnm></td>
                    <td><RebPill>{l.classe === "CUSTEIO" ? "custeio" : "investimento"}</RebPill></td>
                    <td>{l.descricao}</td>
                    <td>{l.areaCodigo ?? "—"}</td>
                    <td>{money(l.valor)}</td>
                    <td>{l.horasMaquina ?? "—"}</td>
                    <td>{l.numMaquinas ?? "—"}</td>
                    <td>{l.numCaminhoes ?? "—"}</td>
                    <td>
                      <RebButton disabled={excluindoId === l.id} onClick={() => excluir(l.id)}>
                        {excluindoId === l.id ? "…" : "Excluir"}
                      </RebButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </RebTable>
          )}
        </>
      )}

      {form && safraCultivoId !== "" && (
        <LancamentoCustoForm
          safraCultivoId={safraCultivoId}
          onFechar={() => setForm(false)}
          onSalvo={() => { setForm(false); recarregar(); }}
        />
      )}
    </RebMain>
  );
}

function LancamentoCustoForm({ safraCultivoId, onFechar, onSalvo }: { safraCultivoId: number; onFechar: () => void; onSalvo: () => void }) {
  const { data: areas } = useAreasCultivo(safraCultivoId);
  const [areaCultivoId, setAreaCultivoId] = useState<string>("");
  const [tipo, setTipo] = useState<TipoCustoCultivo>("ADUBACAO");
  const [classe, setClasse] = useState<ClassificacaoCategoria>("CUSTEIO");
  const [data, setData] = useState<string>(HOJE);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [horasMaquina, setHorasMaquina] = useState("");
  const [numMaquinas, setNumMaquinas] = useState("");
  const [numCaminhoes, setNumCaminhoes] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: LancamentoCustoInput = {
        safraCultivoId,
        tipo,
        classe,
        data: data || HOJE,
        descricao,
        valor: Number(valor),
        // Opcionais: só entram no payload quando preenchidos (undefined caso contrário).
        areaCultivoId: areaCultivoId ? Number(areaCultivoId) : undefined,
        horasMaquina: horasMaquina ? Number(horasMaquina) : undefined,
        numMaquinas: numMaquinas ? Number(numMaquinas) : undefined,
        numCaminhoes: numCaminhoes ? Number(numCaminhoes) : undefined,
        observacao: observacao || undefined,
      };
      await criarLancamentoCusto(payload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title="Lançar custo"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !descricao || !valor} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Tipo*" style={{ flex: 1 }}>
          <select className="rb-field-select" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCustoCultivo)}>
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
          </select>
        </RebField>
        <RebField label="Classe*" style={{ flex: 1 }}>
          <select className="rb-field-select" value={classe} onChange={(e) => setClasse(e.target.value as ClassificacaoCategoria)}>
            <option value="CUSTEIO">Custeio</option>
            <option value="INVESTIMENTO">Investimento</option>
          </select>
        </RebField>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Data*" style={{ flex: 1 }}>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Área" style={{ flex: 1 }}>
          <select className="rb-field-select" value={areaCultivoId} onChange={(e) => setAreaCultivoId(e.target.value)}>
            <option value="">—</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </RebField>
        <RebField label="Valor (R$)*" style={{ flex: 1 }}>
          <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Descrição*">
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Adubação de cobertura — ureia" />
      </RebField>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Horas-máquina" style={{ flex: 1 }}>
          <input type="number" step="0.1" value={horasMaquina} onChange={(e) => setHorasMaquina(e.target.value)} />
        </RebField>
        <RebField label="Nº de máquinas" style={{ flex: 1 }}>
          <input type="number" value={numMaquinas} onChange={(e) => setNumMaquinas(e.target.value)} />
        </RebField>
        <RebField label="Nº de caminhões" style={{ flex: 1 }}>
          <input type="number" value={numCaminhoes} onChange={(e) => setNumCaminhoes(e.target.value)} />
        </RebField>
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
