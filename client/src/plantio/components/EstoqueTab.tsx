import { useMemo, useState } from "react";
import type { TipoInsumoPlantio } from "../types";

/* Estoque de insumos da lavoura — espelha a EstoqueTab do rebanho.
 * Os produtos refletem o que uma fazenda Sul Minas de ~80 ha realmente
 * tem em galpão na época: fertilizantes (NPK + ureia + KCl), fungicidas
 * cúpricos e sistêmicos, inseticidas (broca e bicho-mineiro), herbicidas
 * e calcário. Custos atualizados Mar/2026. */

type Saldo = {
  produtoId: number;
  nome: string;
  tipo: TipoInsumoPlantio;
  saldo: number;
  unidade: string;
  valor: number;        // R$
  minimoEstoque: number | null;
  abaixoMinimo: boolean;
};

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

const SALDOS: Saldo[] = [
  { produtoId:  1, nome: "Sulfato de amônio 21% N",         tipo: "FERTILIZANTE", saldo:  4_800, unidade: "kg", valor:  14_400, minimoEstoque: 2_000, abaixoMinimo: false },
  { produtoId:  2, nome: "Cloreto de potássio 60% K₂O",     tipo: "FERTILIZANTE", saldo:  2_200, unidade: "kg", valor:  10_120, minimoEstoque: 2_500, abaixoMinimo: true },
  { produtoId:  3, nome: "Ureia 46% N",                     tipo: "FERTILIZANTE", saldo:  1_900, unidade: "kg", valor:   8_550, minimoEstoque: 1_500, abaixoMinimo: false },
  { produtoId:  4, nome: "Formulado 20-00-20",              tipo: "FERTILIZANTE", saldo:  3_400, unidade: "kg", valor:  13_600, minimoEstoque: 2_000, abaixoMinimo: false },
  { produtoId:  5, nome: "MAP 11-52-00",                    tipo: "FERTILIZANTE", saldo:    900, unidade: "kg", valor:   4_950, minimoEstoque: 1_000, abaixoMinimo: true },
  { produtoId:  6, nome: "Calcário dolomítico PRNT 85%",    tipo: "CORRETIVO",    saldo: 18_000, unidade: "kg", valor:   5_400, minimoEstoque: 8_000, abaixoMinimo: false },
  { produtoId:  7, nome: "Gesso agrícola",                  tipo: "CORRETIVO",    saldo:  6_500, unidade: "kg", valor:   2_275, minimoEstoque: 3_000, abaixoMinimo: false },
  { produtoId:  8, nome: "Oxicloreto de cobre (Recop)",     tipo: "DEFENSIVO",    saldo:    140, unidade: "kg", valor:   3_640, minimoEstoque: 100, abaixoMinimo: false },
  { produtoId:  9, nome: "Ciproconazol + Trifloxistrobina (Priori Xtra)", tipo: "DEFENSIVO", saldo: 28, unidade: "L", valor:   8_120, minimoEstoque: 20, abaixoMinimo: false },
  { produtoId: 10, nome: "Epoxiconazol + Piraclostrobina (Opera)", tipo: "DEFENSIVO", saldo:   18, unidade: "L", valor:   5_220, minimoEstoque: 15, abaixoMinimo: false },
  { produtoId: 11, nome: "Tiametoxam (Actara)",             tipo: "DEFENSIVO",    saldo:    6.5, unidade: "kg", valor:   3_900, minimoEstoque: 8, abaixoMinimo: true },
  { produtoId: 12, nome: "Endossulfan (broca)",             tipo: "DEFENSIVO",    saldo:    0,   unidade: "L", valor:       0, minimoEstoque: null, abaixoMinimo: false },
  { produtoId: 13, nome: "Glifosato 480 g/L",               tipo: "HERBICIDA",    saldo:    52,  unidade: "L", valor:   1_872, minimoEstoque: 30, abaixoMinimo: false },
  { produtoId: 14, nome: "Beauveria bassiana (biológico)",  tipo: "BIOLOGICO",    saldo:    14,  unidade: "kg", valor:   1_540, minimoEstoque: 10, abaixoMinimo: false },
  { produtoId: 15, nome: "Foliar Zn + B (Stoller)",         tipo: "FOLIAR",       saldo:    32,  unidade: "L", valor:   2_240, minimoEstoque: 25, abaixoMinimo: false },
  { produtoId: 16, nome: "Mudas Catuaí Amarelo IAC 144",    tipo: "MUDA",         saldo:    480, unidade: "un", valor:     720, minimoEstoque: null, abaixoMinimo: false },
];

const TIPOS_FILTRO: TipoInsumoPlantio[] = ["FERTILIZANTE", "DEFENSIVO", "HERBICIDA", "CORRETIVO", "BIOLOGICO", "FOLIAR", "MUDA"];

const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function EstoqueTab() {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoInsumoPlantio | "">("");
  const [soAbaixoMin, setSoAbaixoMin] = useState(false);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return SALDOS.filter((s) => {
      if (tipoFiltro && s.tipo !== tipoFiltro) return false;
      if (soAbaixoMin && !s.abaixoMinimo) return false;
      if (!termo) return true;
      return s.nome.toLowerCase().includes(termo) || TIPO_LBL[s.tipo].toLowerCase().includes(termo);
    });
  }, [busca, tipoFiltro, soAbaixoMin]);

  const totalEstoque = SALDOS.reduce((a, s) => a + s.valor, 0);
  const nAbaixo = SALDOS.filter((s) => s.abaixoMinimo).length;
  // Custo médio R$/ha — total ÷ ~80 ha de produção
  const custoHa = totalEstoque / 80;

  return (
    <main className="rb-main">
      <div className="rb-eyebrow">Lavoura · insumos da safra</div>
      <div className="rb-head"><h1>Estoque</h1></div>

      <div className="rb-kstrip" style={{ ["--cols" as any]: 4 }}>
        <div className="rb-k" style={{ borderLeft: "3px solid var(--leite)" }}>
          <div className="lab">Valor em estoque</div>
          <div className="val" style={{ fontSize: 28, color: "var(--cafe)" }}>{money(totalEstoque)}</div>
          <div className="d">{SALDOS.length} produtos estocados</div>
        </div>
        <div className="rb-k"><div className="lab">Custo / ha</div><div className="val">{money(custoHa)}</div><div className="d">média sobre área em produção</div></div>
        <div className="rb-k"><div className="lab">Abaixo do mínimo</div><div className={"val" + (nAbaixo > 0 ? " rb-up" : "")}>{nAbaixo}</div><div className="d">precisam de reposição</div></div>
        <div className="rb-k"><div className="lab">Defensivos</div><div className="val">{SALDOS.filter((s) => s.tipo === "DEFENSIVO").length}</div><div className="d">princípios ativos</div></div>
      </div>

      <div className="rb-listhead">
        <h2 className="rb-sec-title" style={{ margin: 0 }}>Saldos</h2>
        <span className="hint">{visiveis.length} de {SALDOS.length} {SALDOS.length === 1 ? "produto" : "produtos"}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px", flexWrap: "wrap" }}>
        <input type="search" className="rb-fld" placeholder="Buscar por nome ou tipo…"
          value={busca} onChange={(e) => setBusca(e.target.value)}
          style={{ flex: "1 1 240px", maxWidth: 320 }} />
        <select className="rb-select" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value as any)}>
          <option value="">Todos os tipos</option>
          {TIPOS_FILTRO.map((t) => <option key={t} value={t}>{TIPO_LBL[t]}</option>)}
        </select>
        {nAbaixo > 0 && (
          <button type="button" className={"rb-chip-q" + (soAbaixoMin ? " on" : "")}
            onClick={() => setSoAbaixoMin((v) => !v)}
            style={soAbaixoMin ? { borderColor: "var(--neg)", color: "var(--neg)" } : undefined}>
            ⚠ Só abaixo do mínimo ({nAbaixo})
          </button>
        )}
        <button className="rb-btn pri" style={{ marginLeft: "auto" }}>+ Registrar movimento</button>
      </div>

      <div className="rb-tbl-wrap"><table className="rb-tbl">
        <thead><tr><th>Produto</th><th>Tipo</th><th>Saldo</th><th>Valor</th><th>Mínimo</th></tr></thead>
        <tbody>{visiveis.map((s) => (
          <tr key={s.produtoId}>
            <td className="rb-anm">{s.nome} {s.abaixoMinimo && <span className="rb-pill bad">⚠ abaixo do mínimo</span>}</td>
            <td>{TIPO_LBL[s.tipo]}</td>
            <td>{qtd(s.saldo)} {s.unidade}</td>
            <td>{money(s.valor)}</td>
            <td>{s.minimoEstoque != null ? `${qtd(s.minimoEstoque)} ${s.unidade}` : "—"}</td>
          </tr>
        ))}</tbody>
      </table></div>

      {visiveis.length === 0 && <div className="rb-empty" style={{ marginTop: 12 }}>Nenhum produto bate com a busca.</div>}
    </main>
  );
}
