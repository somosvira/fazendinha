import { useMemo, useState } from "react";
import type { TipoInsumoPlantio } from "../types";
import { useEstoquePlantio } from "../api";
import { ToolbarSelect } from "@/components/ToolbarSelect";

/* Estoque de insumos da lavoura — espelha a EstoqueTab do rebanho.
 * Agora REAL (DB-backed): lê GET /api/plantio/estoque, que devolve os Produto
 * com `subtipoPlantio` preenchido e o saldo computado dos MovimentoEstoque.
 * Os produtos refletem o que uma fazenda Sul Minas de ~80 ha realmente
 * tem em galpão na época: fertilizantes (NPK + ureia + KCl), fungicidas
 * cúpricos e sistêmicos, inseticidas (broca e bicho-mineiro), herbicidas
 * e calcário. Custos atualizados Mar/2026. */

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
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · insumos da safra</div>
      <div className="rb-head"><h1>Estoque</h1></div>

      {erro && <div className="rb-empty" style={{ borderColor: "var(--neg)", color: "var(--neg)" }}>Erro ao carregar o estoque: {erro}</div>}
      {loading && !erro && <div className="rb-empty">Carregando estoque…</div>}

      {!loading && !erro && (
        <>
          <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
            <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
              <div className="lab">Valor em estoque</div>
              <div className="val" style={{ fontSize: 28, color: "var(--cafe)" }}>{money(totalEstoque)}</div>
              <div className="d">{saldos.length} produtos estocados</div>
            </div>
            <div className="rb-k"><div className="lab">Custo / ha</div><div className="val">{money(custoHa)}</div><div className="d">média sobre área em produção</div></div>
            <div className="rb-k"><div className="lab">Abaixo do mínimo</div><div className={"val" + (nAbaixo > 0 ? " rb-up" : "")}>{nAbaixo}</div><div className="d">precisam de reposição</div></div>
            <div className="rb-k"><div className="lab">Defensivos</div><div className="val">{saldos.filter((s) => s.tipo === "DEFENSIVO").length}</div><div className="d">princípios ativos</div></div>
          </div>

          <div className="rb-listhead">
            <h2 className="rb-sec-title" style={{ margin: 0 }}>Saldos</h2>
            <span className="hint">{visiveis.length} de {saldos.length} {saldos.length === 1 ? "produto" : "produtos"}</span>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px", flexWrap: "wrap" }}>
            <input type="search" className="rb-fld" placeholder="Buscar por nome ou tipo…"
              value={busca} onChange={(e) => setBusca(e.target.value)}
              style={{ flex: "1 1 240px", maxWidth: 320 }} />
            <ToolbarSelect
              value={tipoFiltro}
              onChange={(v) => setTipoFiltro(v as TipoInsumoPlantio | "")}
              ariaLabel="Filtrar por tipo de insumo"
              options={[{ value: "", label: "Todos os tipos" }, ...TIPOS_FILTRO.map((t) => ({ value: t, label: TIPO_LBL[t] }))]}
            />
            {nAbaixo > 0 && (
              <button type="button" className={"rb-chip-q" + (soAbaixoMin ? " on" : "")}
                onClick={() => setSoAbaixoMin((v) => !v)}
                style={soAbaixoMin ? { borderColor: "var(--neg)", color: "var(--neg)" } : undefined}>
                ⚠ Só abaixo do mínimo ({nAbaixo})
              </button>
            )}
            <button className="rb-btn pri" style={{ marginLeft: "auto" }}>+ Registrar movimento</button>
          </div>

          {saldos.length === 0 ? (
            <div className="rb-empty">Nenhum insumo cadastrado no estoque da lavoura ainda.</div>
          ) : (
            <>
              <div className="rb-tbl-wrap"><table className="rb-tbl">
                <thead><tr><th>Produto</th><th>Tipo</th><th>Saldo</th><th>Valor</th><th>Mínimo</th></tr></thead>
                <tbody>{visiveis.map((s) => (
                  <tr key={s.produtoId}>
                    <td className="rb-anm">{s.nome} {s.abaixoMinimo && <span className="rb-pill bad">⚠ abaixo do mínimo</span>}</td>
                    <td>{tipoLabel(s.tipo)}</td>
                    <td>{qtd(s.saldo)} {s.unidade}</td>
                    <td>{money(s.valor)}</td>
                    <td>{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${s.unidade}` : "—"}</td>
                  </tr>
                ))}</tbody>
              </table></div>

              {visiveis.length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhum produto bate com a busca.</div>}
            </>
          )}
        </>
      )}
    </main>
  );
}
