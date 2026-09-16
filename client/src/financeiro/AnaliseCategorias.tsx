import { useEffect, useState } from "react";
import { obterAnaliseCategorias, obterConfiguracoesFinanceiras, type AnaliseCategorias as Dados, type ConfiguracoesFinanceiras } from "./novo-api";
import { brl, ErrorBox, Panel } from "./financeiro-ui";
import { CampoData } from "../components/CampoData";
import { CampoSelect } from "../components/CampoSelect";
import { SelectBusca } from "../components/SelectBusca";

/* As frases curtas resumem o que o serviço soma em cada base
 * (server/src/services/financeiro/analise-categorias.ts). */
const OPCOES_BASE = [
  { value: "compras", label: "Compras e serviços", descricao: "Quanto foi comprado em produtos e serviços, pela data da compra." },
  { value: "pagamentos", label: "Pagamentos", descricao: "Quanto saiu das contas para pagar, pela data do pagamento." },
  { value: "pendente", label: "A pagar", descricao: "Quanto ainda falta pagar nas parcelas que vencem no período." },
];
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
        <label className="text-sm">Consultar<CampoSelect aria-label="Consultar" value={filtros.base} onValueChange={(v) => alterar("base", v)} options={OPCOES_BASE} /></label>
        <label className="text-sm">Data inicial<CampoData aria-label="Data inicial" value={filtros.inicio} onChange={(v) => alterar("inicio", v)} /></label>
        <label className="text-sm">Data final<CampoData aria-label="Data final" value={filtros.fim} onChange={(v) => alterar("fim", v)} /></label>
        <label className="text-sm">Categoria<SelectBusca aria-label="Categoria" value={filtros.categoriaId} onValueChange={(v) => alterar("categoriaId", v)} opcaoVazia="Todas as categorias" options={[{ value: "0", label: "Sem categoria" }, ...(config?.categorias ?? []).map((c) => ({ value: String(c.id), label: `${c.nome}${c.ativo ? "" : " (inativa)"}` }))]} buscaPlaceholder="Buscar categoria…" /></label>
        <label className="text-sm">Centro de custo<SelectBusca aria-label="Centro de custo" value={filtros.centroCustoId} onValueChange={(v) => alterar("centroCustoId", v)} opcaoVazia="Todos os centros" options={[{ value: "0", label: "Sem centro de custo" }, ...(config?.centrosCusto ?? []).map((c) => ({ value: String(c.id), label: `${c.nome}${c.ativo ? "" : " (inativo)"}` }))]} buscaPlaceholder="Buscar centro de custo…" /></label>
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
