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

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    <main className="rb-main">
      <div className="rb-eyebrow">Cultivo · milho</div>
      <div className="rb-head"><h1>Custos</h1></div>

      <div className="rb-toolbar" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
        <button className="rb-btn pri" style={{ marginLeft: "auto" }} disabled={!safraCultivoId} onClick={() => setForm(true)}>
          + Lançar custo
        </button>
      </div>
      {!safraCultivoId && <p className="rb-sub">Selecione uma safra para lançar um novo custo.</p>}

      {erro ? (
        <p className="rb-sub" style={{ color: "var(--neg)" }}>Erro ao carregar custos: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 3 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Total lançado</div>
              <div className="val" style={{ fontSize: 26, color: "var(--cafe)" }}>{money(total)}</div>
              <div className="d">{data.length} {data.length === 1 ? "lançamento" : "lançamentos"}</div>
            </div>
            <div className="rb-k">
              <div className="lab">Horas-máquina</div>
              <div className="val">{horasTotais.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}<u>h</u></div>
            </div>
            <div className="rb-k">
              <div className="lab">Classe</div>
              <div className="val" style={{ fontSize: 18 }}>{classe === "tudo" ? "custeio + investimento" : classe}</div>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="rb-empty">Nenhum lançamento de custo encontrado.</div>
          ) : (
            <div className="rb-tbl-wrap"><table className="rb-tbl">
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
                    <td className="rb-anm">{TIPO_LABEL[l.tipo]}</td>
                    <td><span className="rb-pill">{l.classe === "CUSTEIO" ? "custeio" : "investimento"}</span></td>
                    <td>{l.descricao}</td>
                    <td>{l.areaCodigo ?? "—"}</td>
                    <td>{money(l.valor)}</td>
                    <td>{l.horasMaquina ?? "—"}</td>
                    <td>{l.numMaquinas ?? "—"}</td>
                    <td>{l.numCaminhoes ?? "—"}</td>
                    <td>
                      <button className="rb-btn" disabled={excluindoId === l.id} onClick={() => excluir(l.id)}>
                        {excluindoId === l.id ? "…" : "Excluir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
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
    </main>
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
    <>
      <div className="rb-drawer-bg" onClick={onFechar} />
      <aside className="rb-drawer" role="dialog">
        <div className="rb-drawer-head">
          <h3>Lançar custo</h3>
          <button className="rb-drawer-x" onClick={onFechar} aria-label="Fechar">×</button>
        </div>
        <div className="rb-drawer-body">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Tipo*</label>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCustoCultivo)}>
                {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Classe*</label>
              <select value={classe} onChange={(e) => setClasse(e.target.value as ClassificacaoCategoria)}>
                <option value="CUSTEIO">Custeio</option>
                <option value="INVESTIMENTO">Investimento</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Data*</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Área</label>
              <select value={areaCultivoId} onChange={(e) => setAreaCultivoId(e.target.value)}>
                <option value="">—</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
              </select>
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Valor (R$)*</label>
              <input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
          </div>

          <div className="rb-fld">
            <label>Descrição*</label>
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Adubação de cobertura — ureia" />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Horas-máquina</label>
              <input type="number" step="0.1" value={horasMaquina} onChange={(e) => setHorasMaquina(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Nº de máquinas</label>
              <input type="number" value={numMaquinas} onChange={(e) => setNumMaquinas(e.target.value)} />
            </div>
            <div className="rb-fld" style={{ flex: 1 }}>
              <label>Nº de caminhões</label>
              <input type="number" value={numCaminhoes} onChange={(e) => setNumCaminhoes(e.target.value)} />
            </div>
          </div>

          <div className="rb-fld">
            <label>Observação</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
          </div>
          {erro && <p style={{ color: "var(--neg)", fontSize: 13 }}>{erro}</p>}
        </div>

        <div className="rb-drawer-actions">
          <button className="rb-btn" onClick={onFechar}>Cancelar</button>
          <button className="rb-btn pri" disabled={salvando || !descricao || !valor} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
      </aside>
    </>
  );
}
