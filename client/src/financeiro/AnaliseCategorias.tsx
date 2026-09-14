import { useEffect, useState } from "react";
import { obterAnaliseCategorias, obterConfiguracoesFinanceiras, type AnaliseCategorias as Dados, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, ErrorBox, Panel } from "./financeiro-ui";

const SELECT = "mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm";
const hoje = new Date().toISOString().slice(0, 10);
const explicacoes: Record<string, string> = {
  compras: "Valor dos itens comprados e serviços contratados na data da operação. Operações canceladas são excluídas.",
  pagamentos: "Valores pagos no período, distribuídos entre as categorias dos itens. Estornos reduzem a categoria original na data do estorno.",
  pendente: "Saldo ainda a pagar dos compromissos com vencimento no período, distribuído entre as categorias dos itens.",
};

export function AnaliseCategorias() {
  const [filtros, setFiltros] = useState({ inicio: `${hoje.slice(0, 7)}-01`, fim: hoje, base: "compras", categoriaId: "", centroCustoId: "" });
  const [config, setConfig] = useState<ConfiguracoesFinanceiras | null>(null);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => { let atual = true; obterConfiguracoesFinanceiras().then((c) => { if (atual) setConfig(c); }).catch((e) => { if (atual) setErro(e.message); }); return () => { atual = false; }; }, []);
  useEffect(() => {
    let atual = true; setCarregando(true); setErro(null);
    obterAnaliseCategorias(filtros).then((d) => { if (atual) setDados(d); }).catch((e) => { if (atual) { setErro(e.message); setDados(null); } }).finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [filtros]);
  const alterar = (campo: keyof typeof filtros, valor: string) => setFiltros((f) => ({ ...f, [campo]: valor }));
  return <section className="mt-8" aria-labelledby="analise-categorias-titulo">
    <h2 id="analise-categorias-titulo" className="font-serif text-2xl">Despesas por categoria</h2>
    <p className="mt-2 text-sm text-ink-3">Consulte quanto foi comprado, pago ou está a pagar na fazenda selecionada.</p>
    <Panel className="mt-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">Consultar<select className={SELECT} value={filtros.base} onChange={(e) => alterar("base", e.target.value)}><option value="compras">Compras e serviços</option><option value="pagamentos">Pagamentos</option><option value="pendente">A pagar</option></select></label>
        <label className="text-sm">Data inicial<input type="date" className={SELECT} value={filtros.inicio} onChange={(e) => alterar("inicio", e.target.value)} /></label>
        <label className="text-sm">Data final<input type="date" className={SELECT} value={filtros.fim} onChange={(e) => alterar("fim", e.target.value)} /></label>
        <label className="text-sm">Categoria<select className={SELECT} value={filtros.categoriaId} onChange={(e) => alterar("categoriaId", e.target.value)}><option value="">Todas as categorias</option><option value="0">Sem categoria</option>{config?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativa)"}</option>)}</select></label>
        <label className="text-sm">Centro de custo<select className={SELECT} value={filtros.centroCustoId} onChange={(e) => alterar("centroCustoId", e.target.value)}><option value="">Todos os centros</option><option value="0">Sem centro de custo</option>{config?.centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.ativo ? "" : " (inativo)"}</option>)}</select></label>
      </div>
      <p className="mt-4 text-sm text-ink-3">{explicacoes[filtros.base]}</p><ErrorBox erro={erro} />
      {carregando ? <p className="mt-5" role="status">Calculando despesas…</p> : dados && <>
        <p className="my-5 text-lg">Total no filtro: <strong>{brl(dados.total)}</strong></p>
        {!dados.linhas.length ? <p className="text-sm text-ink-3">Nenhuma despesa encontrada neste filtro.</p> : <>
          <div className="flex flex-wrap gap-3">{dados.categorias.map((c, i) => <div key={`${c.categoria}-${i}`} className="rounded border border-border px-4 py-3 text-sm">{c.categoria}<strong className="ml-4">{brl(c.valor)}</strong></div>)}</div>
          <div className="mt-5 overflow-x-auto"><table className="w-full text-center text-sm"><thead className="border-b border-border"><tr>{["Data", "Origem", "Categoria", "Centro de custo", "Classificação", "Valor"].map((t) => <th key={t} className="p-3 font-medium">{t}</th>)}</tr></thead><tbody>{dados.linhas.map((l, i) => <tr key={`${l.operacaoId}-${i}`} className="border-b border-border"><td className="p-3 whitespace-nowrap">{l.data.split("-").reverse().join("/")}</td><td className="p-3"><a className="underline underline-offset-4" href={l.operacaoId != null ? `/financeiro/operacoes/${l.operacaoId}` : `/financeiro/contas/${l.contaId}#movimento-${l.movimentoId}`}>{l.descricao ?? (l.operacaoId != null ? `OP-${l.operacaoId}` : "Pagamento avulso")}</a></td><td className="p-3">{l.categoria}</td><td className="p-3">{l.centroCusto}</td><td className="p-3">{l.classificacao === "INVESTIMENTO" ? "Investimento" : l.classificacao === "CUSTEIO" ? "Custeio" : "Não classificada"}</td><td className="p-3 whitespace-nowrap">{brl(l.valor)}</td></tr>)}</tbody></table></div>
        </>}
      </>}
    </Panel>
  </section>;
}
