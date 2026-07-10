import { useMemo, useState } from "react";
import { Loader } from "../../components/Loading";
import type { TipoInsumoPlantio } from "../types";
import { useEstoquePlantio } from "../api";
import { RebHeader } from "@/rebanho/components/RebHeader";
import { RebButton } from "@/components/rb/RebButton";
import { REB_FIELD_BOXED } from "@/components/rb/RebField";
import { RebKpiStrip, RebKpi } from "@/components/rb/RebKpiStrip";
import { RebTable } from "@/components/rb/RebTable";
import { RebMain, RebEmpty, RebAnm, RebPill, REB_CHIP_Q } from "@/components/rb/RebPrimitives";
import { ToolbarSelect } from "@/components/ToolbarSelect";

/* Estoque de insumos da lavoura — espelha a EstoqueTab do rebanho.
 * Agora REAL (DB-backed): lê GET /api/plantio/estoque, que devolve os Produto
 * com `subtipoPlantio` preenchido e o saldo computado dos MovimentoEstoque.
 * Os produtos refletem o que uma fazenda Sul Minas de ~80 ha realmente
 * tem em galpão na época: fertilizantes (NPK + ureia + KCl), fungicidas
 * cúpricos e sistêmicos, inseticidas (broca e bicho-mineiro), herbicidas
 * e calcário. Custos atualizados Mar/2026. */

// .rb-k — célula base da faixa de KPI (a 1ª perde a border-left dentro do grid).
const RB_K = "relative border-l border-[color:var(--rule-soft)] bg-transparent px-[22px] pt-1.5 pb-1 first:border-l-0 first:pl-0.5";
const RB_K_LAB = "text-sm font-semibold uppercase tracking-[.06em] text-ink-2";
const RB_K_VAL = "mt-1.5 font-serif text-[32px] font-medium leading-none text-[color:var(--ink)]";
const RB_K_D = "mt-2 text-[15px] font-medium text-ink-2";

const TIPO_LBL: Record<TipoInsumoPlantio, string> = {
  FERTILIZANTE: "Fertilizante",
  DEFENSIVO: "Defensivo",
  HERBICIDA: "Herbicida",
  CORRETIVO: "Corretivo",
  BIOLOGICO: "Biológico",
  FOLIAR: "Foliar",
  MUDA: "Muda",
  OUTRO: "Outro",
};

const TIPOS_FILTRO: TipoInsumoPlantio[] = ["FERTILIZANTE", "DEFENSIVO", "HERBICIDA", "CORRETIVO", "BIOLOGICO", "FOLIAR", "MUDA"];

// Rótulo tolerante a um `tipo` fora do mapa (ex.: OUTRO ou enum novo) — não quebra.
const tipoLabel = (t: string) => (t in TIPO_LBL ? TIPO_LBL[t as TipoInsumoPlantio] : t);

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function EstoqueTab() {
  const { data: saldos, loading, erro } = useEstoquePlantio();
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoInsumoPlantio | "">("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return saldos.filter((s) => {
      if (tipoFiltro && s.tipo !== tipoFiltro) return false;
      if (soAbaixoMin && !s.abaixoMinimo) return false;
      if (!termo) return true;
      return s.nome.toLowerCase().includes(termo) || tipoLabel(s.tipo).toLowerCase().includes(termo);
    });
  }, [saldos, busca, tipoFiltro, soAbaixoMin]);

  const totalEstoque = saldos.reduce((a, s) => a + s.valor, 0);
  const nAbaixo = saldos.filter((s) => s.abaixoMinimo).length;
  // Custo médio R$/ha — total ÷ ~80 ha de produção
  const custoHa = totalEstoque / 80;

  return (
    <RebMain>
      <RebHeader eyebrow="Lavoura · insumos da safra" title="Estoque" />

      {erro && <RebEmpty className="border-[color:var(--neg)] text-[color:var(--neg)]">Erro ao carregar o estoque: {erro}</RebEmpty>}
      {loading && !erro && <Loader label="Carregando estoque…" />}

      {!loading && !erro && (
        <>
          <RebKpiStrip cols={4}>
            <div className={RB_K} style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className={RB_K_LAB}>Valor em estoque</div>
              <div className={RB_K_VAL + " !text-[28px] text-cafe"}>{money(totalEstoque)}</div>
              <div className={RB_K_D}>{saldos.length} produtos estocados</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Custo / ha</div>
              <div className={RB_K_VAL}>{money(custoHa)}</div>
              <div className={RB_K_D}>média sobre área em produção</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Abaixo do mínimo</div>
              <div className={RB_K_VAL + (nAbaixo > 0 ? " text-prejuizo" : "")}>{nAbaixo}</div>
              <div className={RB_K_D}>precisam de reposição</div>
            </div>
            <div className={RB_K}>
              <div className={RB_K_LAB}>Defensivos</div>
              <div className={RB_K_VAL}>{saldos.filter((s) => s.tipo === "DEFENSIVO").length}</div>
              <div className={RB_K_D}>princípios ativos</div>
            </div>
          </RebKpiStrip>

          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="m-0 font-serif text-xl font-medium">Saldos</h2>
            <span className="text-sm text-ink-3">{visiveis.length} de {saldos.length} {saldos.length === 1 ? "produto" : "produtos"}</span>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <input type="search" className={`${REB_FIELD_BOXED} max-w-[320px] flex-[1_1_240px]`} placeholder="Buscar por nome ou tipo…"
              value={busca} onChange={(e) => setBusca(e.target.value)} />
            <ToolbarSelect
              value={tipoFiltro}
              onChange={(v) => setTipoFiltro(v as TipoInsumoPlantio | "")}
              ariaLabel="Filtrar por tipo de insumo"
              options={[{ value: "", label: "Todos os tipos" }, ...TIPOS_FILTRO.map((t) => ({ value: t, label: TIPO_LBL[t] }))]}
            />
            {nAbaixo > 0 && (
              <button type="button" className={REB_CHIP_Q}
                onClick={() => setSoAbaixoMin((v) => !v)}
                style={soAbaixoMin ? { borderColor: "var(--neg)", color: "var(--neg)" } : undefined}>
                ⚠ Só abaixo do mínimo ({nAbaixo})
              </button>
            )}
            <RebButton variant="pri" className="ml-auto">+ Registrar movimento</RebButton>
          </div>

          {saldos.length === 0 ? (
            <RebEmpty>Nenhum insumo cadastrado no estoque da lavoura ainda.</RebEmpty>
          ) : (
            <>
              <RebTable>
                <thead><tr><th>Produto</th><th>Tipo</th><th>Saldo</th><th>Valor</th><th>Mínimo</th></tr></thead>
                <tbody>{visiveis.map((s) => (
                  <tr key={s.produtoId}>
                    <td><RebAnm>{s.nome} {s.abaixoMinimo && <RebPill tone="bad">⚠ abaixo do mínimo</RebPill>}</RebAnm></td>
                    <td>{tipoLabel(s.tipo)}</td>
                    <td>{qtd(s.saldo)} {s.unidade}</td>
                    <td>{money(s.valor)}</td>
                    <td>{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${s.unidade}` : "—"}</td>
                  </tr>
                ))}</tbody>
              </RebTable>

              {visiveis.length === 0 && <RebEmpty className="mt-3">Nenhum produto bate com a busca.</RebEmpty>}
            </>
          )}
        </>
      )}
    </RebMain>
  );
}
