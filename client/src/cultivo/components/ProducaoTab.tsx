import { useState } from "react";
import { Loader } from "../../components/Loading";
import {
  useSafrasCultivo,
  useAreasCultivo,
  useProducoesCultivo,
  useSilos,
  criarProducaoCultivo,
  excluirProducaoCultivo,
  type ProducaoCultivoInput,
} from "../api";
import type { TipoProducao, UnidadeProducao, DestinoProducao } from "../types";
import { HOJE } from "../HOJE";
import { ToolbarSelect } from "@/components/ToolbarSelect";
import { RebHeader } from "@/components/rb/RebHeader";
import { RebKpiStrip } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebButton } from "@/components/rb/RebButton";
import { RebModal } from "@/components/rb/RebModal";
import { RebField } from "@/components/rb/RebField";
import { RebMain, RebEmpty, RebAnm } from "@/components/rb/RebPrimitives";

const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// Reproduz .rb-k para células custom (borda colorida / fonte custom).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";

const TIPO_LABEL: Record<TipoProducao, string> = { GRAO: "Grão", SILAGEM: "Silagem" };
const DESTINO_LABEL: Record<DestinoProducao, string> = { VENDA: "Venda", SILO: "Silo" };

// Unidade padrão por tipo de produção — grão sai em sacas (SC), silagem em toneladas (TON).
const UNIDADE_PADRAO: Record<TipoProducao, UnidadeProducao> = { GRAO: "SC", SILAGEM: "TON" };

/* Lista + cadastro de ProducaoCultivo — saída da colheita do milho, seja grão
 * (SC) ou silagem (TON), com destino opcional para venda ou silo. */
export function ProducaoTab() {
  const { data: safras } = useSafrasCultivo();
  const [safraCultivoId, setSafraCultivoId] = useState<number | "">("");
  const { data, loading, erro, recarregar } = useProducoesCultivo({
    safraCultivoId: safraCultivoId === "" ? undefined : safraCultivoId,
  });
  const [form, setForm] = useState(false);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const totalGrao = data.filter((p) => p.tipo === "GRAO").reduce((a, p) => a + p.quantidade, 0);
  const totalSilagem = data.filter((p) => p.tipo === "SILAGEM").reduce((a, p) => a + p.quantidade, 0);

  async function excluir(id: number) {
    setExcluindoId(id);
    try {
      await excluirProducaoCultivo(id);
      recarregar();
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <RebMain>
      <RebHeader eyebrow="Cultivo · milho" title="Produção" />

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
        <RebButton variant="pri" style={{ marginLeft: "auto" }} disabled={!safraCultivoId} onClick={() => setForm(true)}>
          + Registrar produção
        </RebButton>
      </div>
      {!safraCultivoId && <p className="text-sm text-ink-3">Selecione uma safra para registrar uma nova produção.</p>}

      {erro ? (
        <p className="text-sm text-prejuizo">Erro ao carregar produção: {erro}</p>
      ) : loading ? (
        <Loader />
      ) : (
        <>
          <RebKpiStrip cols={2}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Grão</div>
              <div className={RB_K_VAL} style={{ fontSize: 26, color: "var(--cafe)" }}>{qtd(totalGrao)}<u>sc</u></div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Silagem</div>
              <div className={RB_K_VAL} style={{ fontSize: 26 }}>{qtd(totalSilagem)}<u>ton</u></div>
            </div>
          </RebKpiStrip>

          {data.length === 0 ? (
            <RebEmpty>Nenhuma produção registrada ainda.</RebEmpty>
          ) : (
            <RebTable>
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Área</th><th>Quantidade</th><th>Destino</th><th>Silo</th><th /></tr>
              </thead>
              <tbody>
                {data.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.data).toLocaleDateString("pt-BR")}</td>
                    <td><RebAnm>{TIPO_LABEL[p.tipo]}</RebAnm></td>
                    <td>{p.areaCodigo ?? "—"}</td>
                    <td>{qtd(p.quantidade)} {p.unidade.toLowerCase()}</td>
                    <td>{p.destino ? DESTINO_LABEL[p.destino] : "—"}</td>
                    <td>{p.siloNome ?? "—"}</td>
                    <td>
                      <RebButton disabled={excluindoId === p.id} onClick={() => excluir(p.id)}>
                        {excluindoId === p.id ? "…" : "Excluir"}
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
        <ProducaoForm
          safraCultivoId={safraCultivoId}
          onFechar={() => setForm(false)}
          onSalvo={() => { setForm(false); recarregar(); }}
        />
      )}
    </RebMain>
  );
}

function ProducaoForm({ safraCultivoId, onFechar, onSalvo }: { safraCultivoId: number; onFechar: () => void; onSalvo: () => void }) {
  const { data: areas } = useAreasCultivo(safraCultivoId);
  const [areaCultivoId, setAreaCultivoId] = useState<string>("");
  const [data, setData] = useState<string>(HOJE);
  const [tipo, setTipo] = useState<TipoProducao>("GRAO");
  const [quantidade, setQuantidade] = useState("");
  const [unidade, setUnidade] = useState<UnidadeProducao>(UNIDADE_PADRAO.GRAO);
  const [destino, setDestino] = useState<DestinoProducao | "">("");
  const [siloId, setSiloId] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Silos filtrados pelo tipo compatível com a produção sendo lançada.
  const { data: silos } = useSilos({ tipo, ativo: true });

  function mudarTipo(t: TipoProducao) {
    setTipo(t);
    setUnidade(UNIDADE_PADRAO[t]);
    setSiloId("");
  }

  async function salvar() {
    setSalvando(true); setErro(null);
    try {
      const payload: ProducaoCultivoInput = {
        safraCultivoId,
        data: data || HOJE,
        tipo,
        quantidade: Number(quantidade),
        unidade,
        // Opcionais: só entram no payload quando preenchidos.
        areaCultivoId: areaCultivoId ? Number(areaCultivoId) : undefined,
        destino: destino || undefined,
        siloId: destino === "SILO" && siloId ? Number(siloId) : undefined,
        observacao: observacao || undefined,
      };
      await criarProducaoCultivo(payload);
      onSalvo();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <RebModal
      title="Registrar produção"
      onClose={onFechar}
      actions={
        <>
          <RebButton onClick={onFechar}>Cancelar</RebButton>
          <RebButton variant="pri" disabled={salvando || !quantidade} onClick={salvar}>{salvando ? "Salvando…" : "Salvar"}</RebButton>
        </>
      }
    >
      <div style={{ display: "flex", gap: 10 }}>
        <RebField label="Data*" style={{ flex: 1 }}>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} max={HOJE} />
        </RebField>
        <RebField label="Tipo*" style={{ flex: 1 }}>
          <select className="rb-field-select" value={tipo} onChange={(e) => mudarTipo(e.target.value as TipoProducao)}>
            <option value="GRAO">Grão (SC)</option>
            <option value="SILAGEM">Silagem (TON)</option>
          </select>
        </RebField>
        <RebField label="Área" style={{ flex: 1 }}>
          <select className="rb-field-select" value={areaCultivoId} onChange={(e) => setAreaCultivoId(e.target.value)}>
            <option value="">—</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.codigo}</option>)}
          </select>
        </RebField>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <RebField label={`Quantidade* (${unidade.toLowerCase()})`} style={{ flex: 1 }}>
          <input type="number" step="0.01" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </RebField>
        <RebField label="Destino" style={{ flex: 1 }}>
          <select className="rb-field-select" value={destino} onChange={(e) => setDestino(e.target.value as DestinoProducao | "")}>
            <option value="">—</option>
            <option value="VENDA">Venda</option>
            <option value="SILO">Silo</option>
          </select>
        </RebField>
        {destino === "SILO" && (
          <RebField label="Silo" style={{ flex: 1 }}>
            <select className="rb-field-select" value={siloId} onChange={(e) => setSiloId(e.target.value)}>
              <option value="">Selecione…</option>
              {silos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </RebField>
        )}
      </div>

      <RebField label="Observação">
        <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={2} />
      </RebField>
      {erro && <p className="text-[13px] text-prejuizo">{erro}</p>}
    </RebModal>
  );
}
