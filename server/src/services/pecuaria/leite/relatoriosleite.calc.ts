import { Prisma } from "@prisma/client";

export interface MovimentoBalancoLeite {
  id: string; produtoId: string; produtoNome: string; data: string;
  tipo: string; origem: string; quantidade: Prisma.Decimal.Value; metodoValorizacao: string;
}
export interface ObservacaoSaldoLeite {
  id: string; produtoId: string; produtoNome: string; data: string; litrosObservados: Prisma.Decimal.Value;
  versao: number; referencia: string; responsavel: string;
}
/** Fechamento do razão: quantidade calculada não é medição de tanque nem prova de campo. */
export function calcularBalancoLeite(movimentos: MovimentoBalancoLeite[], inicio: string, fim: string, conferencias: ObservacaoSaldoLeite[] = []) {
  const produtos = [...new Set([...movimentos.filter(m => m.data <= fim).map(m => m.produtoId), ...conferencias.filter(c => c.data <= fim).map(c => c.produtoId)])];
  return produtos.map(produtoId => {
    const linhas = movimentos.filter(m => m.produtoId === produtoId && m.data <= fim);
    const soma = (filtro: (m: MovimentoBalancoLeite) => boolean) => linhas.filter(filtro).reduce((s, m) => s.plus(new Prisma.Decimal(m.quantidade).mul(m.tipo === "ENTRADA" ? 1 : -1)), new Prisma.Decimal(0));
    const abertura = soma(m => m.data < inicio), encerramento = soma(() => true);
    const periodo = (m: MovimentoBalancoLeite) => m.data >= inicio;
    const entradas = soma(m => periodo(m) && m.origem === "PRODUCAO");
    const vendas = soma(m => periodo(m) && ["VENDA", "RETIRADA_LEITE"].includes(m.origem)).negated();
    const interno = soma(m => periodo(m) && m.origem === "NUTRICAO").negated();
    const descarte = soma(m => periodo(m) && m.origem === "PERDA").negated();
    const outros = soma(m => periodo(m) && !["PRODUCAO", "VENDA", "RETIRADA_LEITE", "NUTRICAO", "PERDA"].includes(m.origem));
    const pendencias = [...(linhas.some(m => m.metodoValorizacao !== "LEITE_FIFO_V1") ? ["MOVIMENTOS_SEM_LASTRO_LEITEIRO"] : []),
      ...(!outros.isZero() ? ["OUTROS_MOVIMENTOS_NO_PERIODO"] : []), ...(encerramento.lt(0) ? ["SALDO_NEGATIVO"] : []), ...(linhas.some(m => !["ENTRADA", "SAIDA"].includes(m.tipo)) ? ["TIPO_MOVIMENTO_SEM_REGRA"] : [])];
    const atuais = conferencias.filter(c => c.produtoId === produtoId && c.data <= fim).sort((a, b) => b.data.localeCompare(a.data) || b.versao - a.versao);
    const fechar = atuais.find(c => c.data === fim), abrir = atuais.find(c => c.data < inicio);
    const observado = (c: ObservacaoSaldoLeite | undefined) => c ? { id: c.id, data: c.data, litrosObservados: new Prisma.Decimal(c.litrosObservados).toString(), versao: c.versao, referencia: c.referencia, responsavel: c.responsavel } : null;
    const razaoConhecido = linhas.length > 0;
    const diferenca = fechar && razaoConhecido ? new Prisma.Decimal(fechar.litrosObservados).minus(encerramento) : null;
    const campo = !fechar ? "NAO_REALIZADA" : !razaoConhecido || pendencias.length ? "INCONCLUSIVA" : diferenca?.isZero() ? "SEM_DIVERGENCIA_NO_CORTE" : "DIVERGENTE";
    if (!razaoConhecido) pendencias.push("SEM_MOVIMENTOS_COMPROVADOS");
    return { produtoId, produtoNome: linhas[0]?.produtoNome ?? atuais[0]?.produtoNome ?? "Leite", unidade: "L" as const,
      abertura: razaoConhecido ? abertura.toString() : null, producaoConfirmada: razaoConhecido ? entradas.toString() : null, vendas: razaoConhecido ? vendas.toString() : null, interno: razaoConhecido ? interno.toString() : null, descarte: razaoConhecido ? descarte.toString() : null,
      outrosMovimentos: razaoConhecido ? outros.toString() : null, encerramentoRazao: razaoConhecido ? encerramento.toString() : null,
      identidadeConservada: razaoConhecido && abertura.plus(entradas).minus(vendas).minus(interno).minus(descarte).plus(outros).eq(encerramento),
      confiavel: pendencias.length === 0, pendencias, aberturaObservada: observado(abrir), medicaoCampo: observado(fechar), divergenciaLitros: diferenca?.toString() ?? null,
      naturezaEncerramento: "DERIVADO_DO_RAZAO" as const, conciliacaoCampo: campo };
  });
}

/** Preço documental ponderado: usa parcelas faturadas, nunca litros expedidos ou dinheiro recebido. */
export function calcularPrecoFaturadoLeite(parcelas: { quantidade: Prisma.Decimal.Value; valor: Prisma.Decimal.Value | null }[]) {
  const quantidade = parcelas.reduce((s, p) => s.plus(p.quantidade), new Prisma.Decimal(0));
  const conhecido = parcelas.length > 0 && parcelas.every(p => p.valor !== null);
  const valor = conhecido ? parcelas.reduce((s, p) => s.plus(p.valor!), new Prisma.Decimal(0)) : null;
  return { quantidadeLitros: quantidade.toString(), valorFaturado: valor?.toFixed(2) ?? null,
    precoFaturadoPorLitro: quantidade.gt(0) && valor !== null ? valor.div(quantidade).toFixed(4) : null,
    cobertura: !parcelas.length ? "SEM_ALOCACOES" : conhecido ? "PARCELAS_CONHECIDAS" : "VALOR_PENDENTE",
    unidadePreco: "BRL/L", base: "ALOCACOES_ATIVAS_DEMONSTRATIVOS_VALIDOS" };
}

export function mascararEmissaoLeite<S extends { valores: unknown; valoresIncluidos: boolean }, M extends object>(emissao: M & { snapshot: S }, verValores: boolean) {
  const { valores, ...publico } = emissao.snapshot;
  return { ...emissao, snapshot: { ...publico, valores: verValores ? valores : null } };
}

const celula = (valor: unknown) => {
  const texto = valor == null ? "" : String(valor);
  const seguro = typeof valor === "string" && /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replaceAll('"', '""')}"`;
};
const objeto = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};
const lista = (v: unknown): Record<string, unknown>[] => Array.isArray(v) ? v.map(objeto) : [];
/** CSV de leitura humana, somente do snapshot autorizado, sem consultas vivas. */
export function csvSnapshotLeite(emissao: unknown): string {
  const e = objeto(emissao), s = objeto(e.snapshot ?? emissao), filtros = objeto(s.filtros), site = objeto(s.propriedade), dados = objeto(s.dados), cobertura = objeto(s.cobertura);
  const linhas: unknown[][] = [["Relatório de leite"], ["Referência da emissão", e.id], ["Sítio", site.nome], ["Período", filtros.inicio, filtros.fim], ["Corte da emissão", s.corteEm], ["Método", s.versaoCalculo],
    ["Fonte", "Medições por animal e ordenha; fatos confirmados de estoque; amostras com formato próprio"], ["Conferência física de campo", "Observações manuais explícitas quando disponíveis; razão e observado permanecem separados"],
    ["Produção medida ainda sem confirmação no estoque (L)", cobertura.producaoNaoConfirmadaLitros]];
  const cp = objeto(cobertura.producao);
  linhas.push(["Cobertura do calendário", cp.completa === true ? "Completa" : "Parcial"], ["Dias sem folha", Array.isArray(cp.diasSemFolha) ? cp.diasSemFolha.join(", ") : ""], ["Dias parciais", Array.isArray(cp.diasParciais) ? cp.diasParciais.join(", ") : ""]);
  const producao = objeto(dados.producao);
  linhas.push([], ["Ritmo diário"], ["Data", "Litros medidos (L)", "Estado", "Células esperadas", "Resolvidas", "Pendentes"]);
  for (const d of lista(producao.ritmo)) linhas.push([d.data, d.litros, d.estado, d.esperadas, d.resolvidas, d.pendentes]);
  linhas.push([], ["Produção por animal"], ["Brinco", "Nome", "Litros (L)", "Medições", "Pendências"]);
  for (const a of lista(producao.animais)) { const p = objeto(a.producao); linhas.push([a.brinco, a.nome, p.litros, p.medidas, p.pendentes]); }
  linhas.push([], ["Qualidade por amostra — sem médias entre formatos ou unidades"], ["Data", "Sujeito", "Formato", "Versão", "Campo", "Resultado", "Unidade", "Referência da amostra"]);
  for (const a of lista(dados.qualidade)) {
    const f = objeto(a.formatoSnapshot), sujeito = objeto(a.sujeito), animal = objeto(a.animal);
    const nome = sujeito.tipo === "ANIMAL" ? `Animal ${animal.brinco ?? ""} ${animal.nome ?? ""}`.trim() : `Coletivo: ${sujeito.origem ?? "Origem registrada"}`;
    const resultados = lista(a.resultados);
    if (!resultados.length) linhas.push([a.data, nome, f.nome, f.versao, "Coleta sem resultado", "", "", a.id]);
    for (const r of resultados) { const campo = lista(f.campos).find(c => c.codigo === r.campo); linhas.push([a.data, nome, f.nome, f.versao, campo?.rotulo ?? r.campo, r.valor, r.unidade, a.id]); }
  }
  linhas.push([], ["Fornecimento interno confirmado"], ["Data", "Natureza", "Brinco", "Nome", "Litros servidos (L)", "Referência", "Base da quantidade"]);
  for (const d of lista(dados.destinos)) for (const p of lista(d.parcelas)) { const a = objeto(p.animal); linhas.push([d.data, d.natureza, a.brinco, a.nome, p.quantidadeLitros, d.id, p.baseQuantidade ?? "Conforme destino"]); }
  linhas.push([], ["Descarte físico confirmado"], ["Data", "Litros (L)", "Motivo", "Referência"]);
  for (const d of lista(dados.descartes)) linhas.push([d.data, d.quantidadeLitros, d.motivo, d.id]);
  linhas.push([], ["Balanço do razão por produto — não é medição de campo"], ["Produto", "Abertura do razão (L)", "Observação anterior em", "Abertura observada (L)", "Produção confirmada (L)", "Retiradas comerciais líquidas (L)", "Interno líquido (L)", "Descarte líquido (L)", "Outros movimentos (L)", "Encerramento do razão (L)", "Encerramento observado (L)", "Diferença observado menos razão (L)", "Conferência", "Pendências"]);
  for (const b of lista(dados.balanco)) linhas.push([b.produtoNome, b.abertura, objeto(b.aberturaObservada).data, objeto(b.aberturaObservada).litrosObservados, b.producaoConfirmada, b.vendas, b.interno, b.descarte, b.outrosMovimentos, b.encerramentoRazao, objeto(b.medicaoCampo).litrosObservados, b.divergenciaLitros, b.conciliacaoCampo, Array.isArray(b.pendencias) ? b.pendencias.join(", ") : ""]);
  linhas.push([], ["Retiradas comerciais e inversos"], ["Data", "Venda nº (quando existir)", "Produto", "Tipo", "Litros (L)", "Referência", "Situação comercial"]);
  for (const m of lista(dados.comercial)) linhas.push([m.data, m.numeroOperacao, m.produtoNome, m.tipo, m.quantidadeLitros, m.movimentoId, m.naturezaComercial === "RETIRADA_COM_PRECO_NAO_INFERIDO" ? "Retirada física; preço não inferido" : "Venda registrada"]);
  const documental = objeto(dados.comercialDocumental);
  linhas.push([], ["Entregas e aceite informado"], ["Data", "Venda nº", "Comprador", "Produto", "Referência", "Expedido (L)", "Aceito (L)", "Conferência", "Faturado no recorte (L)"]);
  for (const d of lista(documental.entregas)) linhas.push([d.data, d.numeroOperacao, d.parceiroNome, d.produtoNome, d.referencia, d.expedidoLitros, d.volumeAceito, d.situacao, d.quantidadeFaturadaLitros]);
  linhas.push([], ["Parcelas dos demonstrativos válidos — entregas do período"], ["Referência documental", "Período inicial", "Período final", "Data da entrega", "Venda nº", "Volume da parcela (L)"]);
  for (const d of lista(documental.demonstrativos)) for (const a of lista(d.alocacoes)) linhas.push([d.referencia, d.inicio, d.fim, a.dataEntrega, a.numeroOperacao, a.quantidadeLitros]);
  const valores = objeto(s.valores);
  if (s.valores !== null && Object.keys(valores).length) {
    const custos = objeto(valores.custos), consolidado = objeto(custos.consolidado), total = objeto(consolidado.custos);
    linhas.push([], ["Custos diretos registrados — não é lucro"], ["Total conhecido (BRL)", "Custo por litro (BRL/L)", "Situação", "Componentes pendentes"], [total.totalConhecido, consolidado.custoPorLitro, consolidado.situacao, total.componentesPendentes]);
    linhas.push(["Animal", "Nome", "Total conhecido (BRL)", "Custo por litro (BRL/L)", "Situação"]);
    for (const a of lista(custos.animais)) linhas.push([a.brinco, a.nome, objeto(a.custos).totalConhecido, a.custoPorLitro, a.situacao]);
    linhas.push([], ["Valores comerciais confirmados"], ["Data", "Venda nº", "Comprador", "Litros (L)", "Versão comercial", "Total da venda (BRL)"]);
    for (const v of lista(valores.comercial)) linhas.push([v.data, v.numeroOperacao, v.parceiroNome, v.quantidadeLitros, v.versao, v.valorTotal]);
    const documentos = objeto(valores.documental), faturamento = objeto(documentos.faturamento);
    linhas.push([], ["Preço documental das parcelas faturadas"], ["Volume faturado (L)", "Valor faturado (BRL)", "Preço faturado ponderado (BRL/L)", "Cobertura"], [faturamento.quantidadeLitros, faturamento.valorFaturado, faturamento.precoFaturadoPorLitro, faturamento.cobertura]);
    linhas.push([], ["Valores integrais dos demonstrativos — podem abranger datas além do recorte"], ["Referência", "Preço base (BRL/L)", "Valor comercial (BRL)", "Pagamento informado (BRL), não é caixa"]);
    for (const d of lista(documentos.demonstrativos)) {
      linhas.push([d.referencia, d.precoBase, d.valorComercial, d.valorPagamentoInformado]);
      for (const c of lista(d.componentes)) linhas.push(["Componente declarado", c.natureza, c.referencia, c.valor]);
      for (const a of lista(d.alocacoes)) linhas.push(["Parcela do recorte", a.numeroOperacao, a.quantidadeLitros, a.valor]);
    }
  } else linhas.push([], ["Valores financeiros", "Não incluídos ou acesso oculto"]);
  linhas.push([], ["Limitações"]);
  if (Array.isArray(s.limitacoes)) for (const l of s.limitacoes) linhas.push([l]);
  return "\uFEFF" + linhas.map(l => l.map(celula).join(";")).join("\r\n") + "\r\n";
}
