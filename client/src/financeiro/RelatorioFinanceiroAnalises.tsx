import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ROTULO_ATIVIDADE, ROTULO_MES, ROTULO_TIPO } from "../components/relatorio-gerencial/export";
import type { BlocoCompromisso } from "../components/relatorio-gerencial/types";
import { brl, TabelaFinanceira, type ColunaTabela } from "./financeiro-ui";
import type { SnapshotRelatorioFinanceiro } from "./novo-api";
import { dataCurta } from "./lib/relatorios";

type Grupo = "caixa" | "compras" | "compromissos" | "conferencia";
type Informacao = (titulo: string, texto: string) => ReactNode;
const percentual = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const porcentagemTotal = (total: number | string | null) => total == null ? "—" : Number(total) === 0 ? "0%" : "100%";

function Quadro<T>({ titulo, id, children, base, acao, itens, colunas, chaveDe, rodape, vazio = "Sem registros no recorte." }: {
  titulo: string; id: string; children?: ReactNode; base?: string; acao?: ReactNode;
  itens: T[]; colunas: ColunaTabela<T>[]; chaveDe: (item: T) => React.Key;
  rodape?: Partial<Record<string, ReactNode>>; vazio?: string;
}) {
  return <section className="analise-quadro" aria-labelledby={id}>
    <div className="analise-quadro-titulo"><h3 id={id}>{titulo}{children}</h3>{base && <span className="analise-base">{base}</span>}{acao}</div>
    {itens.length === 0 && <p className="analise-vazio">{vazio}</p>}
    {(itens.length > 0 || rodape) && <TabelaFinanceira compacta larguraMinimaParaTabela={360} rotulo={titulo} itens={itens} colunas={colunas} chaveDe={chaveDe} rodape={rodape} />}
  </section>;
}

function DetalheCompromissos({ titulo, bloco, id }: { titulo: string; bloco: BlocoCompromisso; id: string }) {
  if (!bloco.quantidade && !bloco.itens.length) return null;
  return <div className="analise-compromissos-detalhe"><Quadro titulo={titulo} id={id} itens={bloco.itens.map((item, indice) => ({ ...item, indice }))} chaveDe={item => item.indice} colunas={[
    { chave: "descricao", titulo: "Descrição", principal: true, larguraMinima: 180, celula: item => item.descricao ?? "—" },
    { chave: "parceiro", titulo: "Parceiro", larguraMinima: 140, celula: item => item.fornecedor ?? "—" },
    { chave: "categoria", titulo: "Categoria", larguraMinima: 130, celula: item => item.categoria },
    { chave: "data", titulo: "Vencimento", larguraMinima: 100, celula: item => dataCurta(item.dataVencimento) },
    { chave: "valor", titulo: "Valor", larguraMinima: 100, alinhamento: "direita", celula: item => brl(item.valor) },
    { chave: "situacao", titulo: "Situação", larguraMinima: 120, celula: item => <span className={item.vencido ? "analise-vencido" : undefined}>{item.vencido ? `Vencido há ${item.diasAtraso} dias` : "A vencer"}</span> },
  ]} />{bloco.quantidade > bloco.itens.length && <p className="analise-limite">Exibindo {bloco.itens.length} de {bloco.quantidade} títulos salvos; os totais consideram todos.</p>}</div>;
}

export function RelatorioFinanceiroAnalises({ snapshot, informacao, secaoDestino, onChegar }: {
  snapshot: SnapshotRelatorioFinanceiro; informacao: Informacao; secaoDestino: string | null; onChegar: () => void;
}) {
  const dto = snapshot.gerencial;
  const realizado = dto.meta.regime !== "previsto";
  const contas = realizado ? dto.saldoContas : null;
  const fluxo = realizado ? dto.entradasSaidas : null;
  const resultado = realizado ? dto.resultado : null;
  const pagamentos = realizado ? dto.categorias : null;
  const compromissos = dto.meta.regime !== "realizado" ? dto.compromissos : null;
  const compras = snapshot.composicao.despesas;
  const rastreio = dto.rastreabilidade;
  const raiz = useRef<HTMLDivElement>(null);
  const indice = useRef<HTMLElement>(null);
  const navegando = useRef(false);
  const quadroNavegacao = useRef<number | null>(null);
  const idAtividades = useId();
  const idMeses = useId();
  const [mostrarZeradas, setMostrarZeradas] = useState(false);
  const [mostrarMeses, setMostrarMeses] = useState(false);
  const grupos: { id: Grupo; titulo: string }[] = [
    ...(contas || fluxo || resultado ? [{ id: "caixa" as const, titulo: "Caixa realizado" }] : []),
    { id: "compras", titulo: "Compras e despesas" },
    ...(compromissos ? [{ id: "compromissos" as const, titulo: "Compromissos" }] : []),
    { id: "conferencia", titulo: "Conferência" },
  ];
  const [ativo, setAtivo] = useState<Grupo>(grupos[0].id);
  const assinaturaGrupos = grupos.map(grupo => grupo.id).join(",");

  const ir = (grupo: Grupo) => {
    const titulo = raiz.current?.querySelector<HTMLElement>(`#rg-sec-${grupo}`);
    if (!titulo) return;
    setAtivo(grupo);
    navegando.current = true;
    titulo.focus({ preventScroll: true });
    titulo.scrollIntoView?.({ block: "start" });
    if (typeof window.requestAnimationFrame === "function") {
      if (quadroNavegacao.current != null) window.cancelAnimationFrame(quadroNavegacao.current);
      quadroNavegacao.current = window.requestAnimationFrame(() => { navegando.current = false; quadroNavegacao.current = null; });
    } else navegando.current = false;
  };
  useEffect(() => {
    if (!secaoDestino || !grupos.some(grupo => grupo.id === secaoDestino)) return;
    ir(secaoDestino as Grupo);
    onChegar();
  }, [secaoDestino, onChegar, assinaturaGrupos]); // O destino roda somente após a montagem da aba.
  useEffect(() => {
    const atualizar = () => {
      if (navegando.current) return;
      const limite = (indice.current?.getBoundingClientRect().height ?? 44) + 28;
      const encontrados = Array.from(raiz.current?.querySelectorAll<HTMLElement>("[data-analise-grupo]") ?? []);
      const atual = encontrados.filter(elemento => elemento.getBoundingClientRect().top <= limite).at(-1);
      if (atual) setAtivo(atual.dataset.analiseGrupo as Grupo);
    };
    window.addEventListener("scroll", atualizar, { passive: true });
    return () => {
      window.removeEventListener("scroll", atualizar);
      if (quadroNavegacao.current != null) window.cancelAnimationFrame(quadroNavegacao.current);
    };
  }, [assinaturaGrupos]);

  const zeradas = resultado?.porAtividade.filter(item => [item.receita, item.custeio, item.investimento, item.resultado].every(valor => valor === 0)) ?? [];
  const atividades = resultado?.porAtividade.filter(item => mostrarZeradas || [item.receita, item.custeio, item.investimento, item.resultado].some(valor => valor !== 0)) ?? [];
  return <div ref={raiz} className="relatorio-analises-conteudo">
    <nav ref={indice} className="analise-indice" aria-label="Seções das análises">{grupos.map(grupo => <button key={grupo.id} type="button" aria-current={ativo === grupo.id ? "location" : undefined} onClick={() => ir(grupo.id)}>{grupo.titulo}</button>)}</nav>
    {(contas || fluxo || resultado) && <section className="analise-grupo" data-analise-grupo="caixa" aria-labelledby="rg-sec-caixa">
      <header className="analise-grupo-titulo"><h2 id="rg-sec-caixa" tabIndex={-1}>Caixa realizado</h2><span className="analise-regime analise-regime-realizado">Realizado</span>{informacao("Caixa realizado", "Movimentos liquidados no recorte salvo. Entradas podem incluir aportes e esta leitura não representa lucro. O saldo histórico inclui a abertura e todas as contas da fazenda, sem os filtros aplicados às operações.")}</header>
      {contas && <Quadro titulo="Saldo por conta" id="analise-contas" itens={contas.contas} chaveDe={conta => conta.id} rodape={{ conta: "Total", inicial: brl(contas.total.saldoInicial), entradas: brl(contas.total.entradas), saidas: brl(contas.total.saidas), final: brl(contas.total.saldoFinal) }} colunas={[
        { chave: "conta", titulo: "Conta", principal: true, larguraMinima: 150, celula: conta => conta.nome },
        { chave: "inicial", titulo: "Saldo inicial", alinhamento: "direita", celula: conta => brl(conta.saldoInicial) },
        { chave: "entradas", titulo: "Entradas", alinhamento: "direita", celula: conta => brl(conta.entradas) },
        { chave: "saidas", titulo: "Saídas", alinhamento: "direita", celula: conta => brl(conta.saidas) },
        { chave: "final", titulo: "Saldo final", alinhamento: "direita", celula: conta => brl(conta.saldoFinal) },
      ]}>{informacao("Dados das contas", `Saldo histórico de todas as contas, inclusive inativas e fora do saldo geral. Instituições salvas: ${contas.contas.map(conta => `${conta.nome}: ${conta.banco ?? "Não informada"}`).join("; ") || "Nenhuma conta"}.`)}</Quadro>}
      {(fluxo || resultado) && <div className={`analise-par${!fluxo || !resultado ? " analise-par-unico" : ""}`}>
        {fluxo && <Quadro titulo="Evolução mensal" id="analise-evolucao" itens={fluxo.meses} chaveDe={mes => mes.mes} rodape={{ mes: "Total", entradas: brl(fluxo.total.entradas), saidas: brl(fluxo.total.saidas), resultado: brl(fluxo.total.resultado) }} colunas={[
          { chave: "mes", titulo: "Mês", principal: true, larguraMinima: 85, celula: mes => ROTULO_MES(mes.mes) },
          { chave: "entradas", titulo: "Entradas", alinhamento: "direita", larguraMinima: 105, celula: mes => brl(mes.entradas) },
          { chave: "saidas", titulo: "Saídas", alinhamento: "direita", larguraMinima: 100, celula: mes => brl(mes.saidas) },
          { chave: "resultado", titulo: "Resultado", alinhamento: "direita", larguraMinima: 110, celula: mes => brl(mes.resultado) },
        ]} />}
        {resultado && <div id={idAtividades}><Quadro titulo="Entradas e despesas por atividade" id="analise-atividades" itens={atividades} chaveDe={item => item.atividade} rodape={{ atividade: "Total", entradas: brl(resultado.receita), custeio: brl(resultado.custeio), investimento: brl(resultado.investimento), resultado: brl(resultado.resultado) }} acao={zeradas.length > 0 && <button className="analise-disclosure h-auto" aria-expanded={mostrarZeradas} aria-controls={idAtividades} onClick={() => setMostrarZeradas(!mostrarZeradas)}>{mostrarZeradas ? "Ocultar sem movimentação" : "Mostrar sem movimentação"} ({zeradas.length})<ChevronDown size={14} aria-hidden="true" /></button>} vazio="Nenhuma atividade com movimentação no recorte." colunas={[
          { chave: "atividade", titulo: "Atividade", principal: true, larguraMinima: 75, celula: item => ROTULO_ATIVIDADE[item.atividade] ?? item.atividade },
          { chave: "entradas", titulo: "Entradas", alinhamento: "direita", larguraMinima: 95, celula: item => brl(item.receita) },
          { chave: "custeio", titulo: "Custeio", alinhamento: "direita", larguraMinima: 90, celula: item => brl(item.custeio) },
          { chave: "investimento", titulo: "Investimento", alinhamento: "direita", larguraMinima: 90, celula: item => brl(item.investimento) },
          { chave: "resultado", titulo: "Resultado do caixa", alinhamento: "direita", larguraMinima: 105, celula: item => brl(item.resultado) },
        ]}>{informacao("Entradas e despesas por atividade", "Entradas de caixa podem incluir aportes. Esta leitura não representa lucro. Atividades sem movimentação permanecem disponíveis pelo controle de exibição; os totais salvos nunca mudam.")}</Quadro></div>}
      </div>}
    </section>}
    <section className="analise-grupo" data-analise-grupo="compras" aria-labelledby="rg-sec-compras">
      <header className="analise-grupo-titulo"><h2 id="rg-sec-compras" tabIndex={-1}>Compras e despesas</h2></header>
      <Quadro titulo="Compras por categoria e classificação" id="analise-compras" base="Pela data da operação" itens={compras.porCategoria} chaveDe={categoria => categoria.nome} rodape={{ categoria: "Total", custeio: brl(compras.custeio), investimento: brl(compras.investimento), naoClassificada: brl(compras.semClassificacao), total: brl(compras.total), pct: porcentagemTotal(compras.total) }} colunas={[
        { chave: "categoria", titulo: "Categoria", principal: true, larguraMinima: 200, celula: categoria => categoria.nome },
        { chave: "custeio", titulo: "Custeio", alinhamento: "direita", celula: categoria => brl(categoria.custeio) },
        { chave: "investimento", titulo: "Investimento", alinhamento: "direita", celula: categoria => brl(categoria.investimento) },
        { chave: "naoClassificada", titulo: "Não classificada", alinhamento: "direita", celula: categoria => brl(categoria.semClassificacao) },
        { chave: "total", titulo: "Total", alinhamento: "direita", celula: categoria => brl(categoria.total) },
        { chave: "pct", titulo: "%", alinhamento: "direita", larguraMinima: 70, celula: categoria => percentual(categoria.pct) },
      ]}>{informacao("Compras por categoria e classificação", "Itens das compras e serviços pela data da operação. Os pagamentos abaixo são outra leitura, pela data da liquidação, e não devem ser somados às compras.")}</Quadro>
      {pagamentos && <div className="analise-pagamentos"><p className="analise-base-pagamentos">Pela data do pagamento</p><div className="analise-par">
        <Quadro titulo="Pagamentos realizados por categoria" id="analise-categorias" itens={pagamentos.itens.map((item, indice) => ({ ...item, indice }))} chaveDe={item => item.indice} rodape={{ categoria: "Total", valor: brl(dto.resumo.saidas), pct: porcentagemTotal(dto.resumo.saidas) }} colunas={[
          { chave: "categoria", titulo: "Categoria", principal: true, larguraMinima: 180, celula: item => item.categoria },
          { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 110, celula: item => brl(item.total) },
          { chave: "pct", titulo: "%", alinhamento: "direita", larguraMinima: 65, celula: item => percentual(item.pct) },
        ]} />
        <Quadro titulo="Pagamentos realizados por centro de custo" id="analise-centros" itens={pagamentos.centros.map((item, indice) => ({ ...item, indice }))} chaveDe={item => item.indice} rodape={{ centro: "Total", valor: brl(dto.resumo.saidas), pct: porcentagemTotal(dto.resumo.saidas) }} colunas={[
          { chave: "centro", titulo: "Centro de custo", principal: true, larguraMinima: 180, celula: item => item.centro },
          { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 110, celula: item => brl(item.total) },
          { chave: "pct", titulo: "%", alinhamento: "direita", larguraMinima: 65, celula: item => percentual(item.pct) },
        ]} />
      </div></div>}
    </section>
    {compromissos && <section className="analise-grupo" data-analise-grupo="compromissos" aria-labelledby="rg-sec-compromissos">
      <header className="analise-grupo-titulo"><h2 id="rg-sec-compromissos" tabIndex={-1}>Compromissos</h2><span className="analise-regime analise-regime-previsto">Previsto</span><span className="analise-posicao">Posição em {dataCurta(compromissos.hoje)}</span>{compromissos.aPagar.quantidade === 0 && compromissos.aReceber.quantidade === 0 && <span className="analise-posicao">Nenhum compromisso em aberto neste recorte.</span>}</header>
      <TabelaFinanceira compacta rotulo="Síntese dos compromissos" itens={[{ tipo: "A pagar", bloco: compromissos.aPagar }, { tipo: "A receber", bloco: compromissos.aReceber }]} chaveDe={item => item.tipo} colunas={[
        { chave: "tipo", titulo: "Tipo", principal: true, larguraMinima: 160, celula: item => item.tipo },
        { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", larguraMinima: 100, celula: item => item.bloco.quantidade },
        { chave: "vencido", titulo: "Vencido", alinhamento: "direita", celula: item => <span className={item.bloco.vencido > 0 ? "analise-vencido" : undefined}>{brl(item.bloco.vencido)}</span> },
        { chave: "aVencer", titulo: "A vencer", alinhamento: "direita", celula: item => brl(item.bloco.aVencer) },
        { chave: "total", titulo: "Total", alinhamento: "direita", celula: item => brl(item.bloco.total) },
      ]} />
      <DetalheCompromissos titulo="A pagar" id="analise-compromissos-pagar" bloco={compromissos.aPagar} />
      <DetalheCompromissos titulo="A receber" id="analise-compromissos-receber" bloco={compromissos.aReceber} />
    </section>}
    <section className="analise-grupo" data-analise-grupo="conferencia" aria-labelledby="rg-sec-conferencia">
      <header className="analise-grupo-titulo"><h2 id="rg-sec-conferencia" tabIndex={-1}>Conferência</h2></header>
      <div className="analise-par">
        <Quadro titulo="Movimentações de caixa por tipo" id="analise-movimentos" itens={dto.operacoes.filter(item => item.quantidade > 0 || item.valor !== 0)} chaveDe={item => item.tipo} colunas={[
          { chave: "tipo", titulo: "Tipo", principal: true, larguraMinima: 180, celula: item => item.tipo === "receita" ? "Entradas de caixa (inclui aportes)" : ROTULO_TIPO[item.tipo] },
          { chave: "quantidade", titulo: "Quantidade", alinhamento: "direita", larguraMinima: 70, celula: item => item.quantidade },
          { chave: "valor", titulo: "Valor", alinhamento: "direita", larguraMinima: 110, celula: item => brl(item.valor) },
          { chave: "realizado", titulo: "Compõe realizado", larguraMinima: 105, celula: item => item.entraNoTotal ? "Sim" : "Não" },
        ]}>{informacao("Movimentações de caixa por tipo", "Agrupamento financeiro salvo na emissão. Estornos, transferências, liquidações parciais e compromissos em aberto são identificados separadamente e não inflam os totais realizados.")}</Quadro>
        <section className="analise-auditoria" aria-labelledby="analise-auditoria"><h3 id="analise-auditoria">Auditoria</h3><div className="analise-auditoria-grupos">
          <section aria-label="Documentos"><h4>Documentos</h4><dl><div><dt>Com número</dt><dd>{rastreio.comDocumento}</dd></div><div><dt>Sem número</dt><dd className={rastreio.semDocumento > 0 ? "analise-pendente-documento" : undefined}>{rastreio.semDocumento}</dd></div><div><dt>Com nota fiscal</dt><dd>{rastreio.comNotaFiscal}</dd></div><div><dt>Sem nota fiscal</dt><dd className={rastreio.semNotaFiscal > 0 ? "analise-pendente-documento" : undefined}>{rastreio.semNotaFiscal}</dd></div></dl></section>
          <section aria-label="Lançamentos"><h4>Lançamentos</h4><dl><div><dt>Total</dt><dd>{rastreio.totalLancamentos}</dd></div><div><dt>Estornados</dt><dd>{rastreio.estornados}</dd></div><div><dt>Sem centro de custo</dt><dd>{rastreio.semCentroCusto}</dd></div></dl></section>
          <section aria-label="Períodos"><h4>Períodos</h4><dl><div><dt>Abertos</dt><dd>{rastreio.mesesAbertos.length}</dd></div><div><dt>Fechados</dt><dd>{rastreio.mesesFechados.length}</dd></div></dl><button className="analise-disclosure h-auto" aria-expanded={mostrarMeses} aria-controls={idMeses} onClick={() => setMostrarMeses(!mostrarMeses)}>{mostrarMeses ? "Ocultar meses" : "Ver meses"}<ChevronDown size={14} aria-hidden="true" /></button><div id={idMeses} hidden={!mostrarMeses} className="analise-meses"><p><strong>Abertos:</strong> {rastreio.mesesAbertos.map(ROTULO_MES).join(", ") || "Nenhum"}</p><p><strong>Fechados:</strong> {rastreio.mesesFechados.map(ROTULO_MES).join(", ") || "Nenhum"}</p></div></section>
        </div></section>
      </div>
    </section>
  </div>;
}
