import type { Manifesto } from './contexto.js';
// Identificadores SQL vêm exclusivamente desta lista; chaves/IDs nunca viram SQL.
const tabelas = {
  usuario: 'public."Usuario"', sitio: 'public."Propriedade"', centro: 'public."CentroCusto"', grupo: 'public."GrupoCategoria"',
  categoria: 'public."Categoria"', parceiro: 'public."Parceiro"', conta: 'public."ContaFinanceira"', produto: 'public."Produto"',
  movimentoEstoque: 'public."MovimentoEstoque"', lactacao: 'pecuaria."LactacaoAnimal"',
  partida: 'public."PartidaProduto"', operacao: 'public."Operacao"', periodo: 'public."PeriodoFinanceiro"',
  raca: 'pecuaria."Raca"', motivo: 'pecuaria."MotivoBaixa"', doenca: 'pecuaria."Doenca"', aplicacao: 'pecuaria."TipoAplicacaoSanitaria"',
  exame: 'pecuaria."TipoExame"', genitor: 'pecuaria."GenitorExterno"', material: 'pecuaria."MaterialGenetico"',
  lote: 'pecuaria."Lote"', animal: 'pecuaria."Animal"', tentativa: 'pecuaria."TentativaReprodutiva"',
  avaliacao: 'pecuaria."AvaliacaoReprodutiva"', gestacao: 'pecuaria."GestacaoAnimal"', inicial: 'pecuaria."SituacaoInicialReprodutiva"',
  parto: 'pecuaria."PartoAnimal"', cria: 'pecuaria."CriaParto"', protocolo: 'pecuaria."Protocolo"', programacao: 'pecuaria."ProgramacaoProtocolo"',
  participacao: 'pecuaria."ParticipacaoProtocolo"', rodada: 'pecuaria."ProgramacaoProtocolo"', ocorrencia: 'pecuaria."OcorrenciaSanitaria"',
  aplicacaoFato: 'pecuaria."AplicacaoProduto"', exameFato: 'pecuaria."ExameAnimal"', selecao: 'pecuaria."SelecaoVisita"',
  visita: 'pecuaria."VisitaVeterinaria"', participante: 'pecuaria."ParticipanteVisita"', dieta: 'pecuaria."Dieta"', vigencia: 'pecuaria."VigenciaDietaLote"',
  fechamentoConsumo: 'pecuaria."FechamentoConsumo"', transacao: 'public."TransacaoFinanceira"',
  tanque: 'pecuaria."TanqueLeite"', configuracao: 'pecuaria."ConfiguracaoOrdenha"', controle: 'pecuaria."DiaProducaoLeite"',
  medicao: 'pecuaria."MedicaoGeralLeite"', entrada: 'pecuaria."EntradaProducaoLeite"', qualidade: 'pecuaria."AmostraQualidadeLeite"',
  destino: 'pecuaria."DestinoInternoLeite"', descarte: 'pecuaria."DescarteLeite"', comercial: 'pecuaria."OperacaoComercialLeite"',
  retirada: 'pecuaria."RetiradaOperacaoLeite"', fechamentoLeite: 'pecuaria."FechamentoOperacaoLeite"', entrega: 'pecuaria."EntregaLeite"',
  demonstrativo: 'pecuaria."DemonstrativoLeite"', fornecimento: 'pecuaria."FornecimentoNutricionalLeite"', referencia: 'pecuaria."ReferenciaGerencialLeite"',
  apuracao: 'pecuaria."ApuracaoValorLeite"', conferencia: 'pecuaria."ConferenciaSaldoLeite"', programacaoLeite: 'pecuaria."ProgramacaoRetiradaLeite"',
  relatorio: 'pecuaria."EmissaoRelatorioLeite"', arquivoQualidade: 'pecuaria."LaudoQualidadeLeite"', arquivoEntrega: 'pecuaria."ComprovanteEntregaLeite"', arquivoRetirada: 'pecuaria."ComprovanteRetiradaOperacaoLeite"',
} as const;
type Tabela = keyof typeof tabelas;
export function tabelaReferencia(chave: string): Tabela | null {
  if (chave.startsWith('seedatev5-v1:')) {
    const ref = chave.slice('seedatev5-v1:'.length);
    if (ref.startsWith('cobertura:')) {
      const cobertura: Record<string, Tabela> = {
        'cobertura:parto-historico-arrendado': 'parto', 'cobertura:lactacao-historica-arrendado': 'lactacao',
        'cobertura:configuracao-primeira-ordenha': 'configuracao', 'cobertura:primeira-ordenha-historica': 'medicao',
        'cobertura:direta-desconhecida': 'medicao', 'cobertura:zero-explicito': 'medicao',
        'cobertura:parcela-regularizada': 'medicao', 'cobertura:parcela-corrigida': 'medicao',
        'cobertura:entrada-original': 'entrada', 'cobertura:entrada-corrigida': 'entrada',
        'cobertura:anular-entrada-original': 'movimentoEstoque', 'cobertura:inclusao-posterior': 'medicao',
      };
      const tabela = cobertura[ref];
      if (!tabela) throw new Error(`Referência de cobertura sem contrato de existência: ${chave}.`);
      return tabela;
    }
    if (ref === 'data:controle') return null; // Metadado civil explicitamente não é uma entidade.
    if (ref.startsWith('formato')) return 'exame';
    if (ref === 'dieta:vigencia') return 'vigencia';
    if (ref === 'nutricao:fechamento') return 'fechamentoConsumo';
    if (ref === 'nutricao:fornecimento') return 'fornecimento';
    if (ref === 'nutricao:revisar-referencia') return 'referencia';
    if (ref.startsWith('comercial:')) {
      if (ref.includes(':retirada-id:')) return 'retirada';
      if (ref.endsWith(':recebimento')) return 'transacao';
      if (ref.endsWith(':fechamento')) return 'fechamentoLeite';
      return 'comercial';
    }
    if (ref === 'venda:imediata') return 'operacao';
    if (ref.startsWith('programacao:')) return 'programacaoLeite';
    if (ref.startsWith('arquivo:')) {
      const tipo = ref.slice(8); if (tipo === 'qualidade') return 'arquivoQualidade'; if (tipo === 'entrega') return 'arquivoEntrega'; if (tipo === 'retirada') return 'arquivoRetirada';
    }
    return tabelaReferencia(ref);
  }
  if (chave.startsWith('visita:participante:')) return 'participante';
  if (chave.startsWith('dieta:vigencia:')) return 'vigencia';
  if (chave.startsWith('fato:aplicacao:')) return 'aplicacaoFato';
  if (chave.startsWith('exame:tratamento:')) return 'exameFato';
  if (/^(positivo|negativo|inconclusivo|reconfirmacao):/.test(chave)) return 'avaliacao';
  if (chave.startsWith('nutricao:')) return 'fechamentoConsumo';
  const prefixo = chave.split(':')[0];
  if (Object.hasOwn(tabelas, prefixo)) return prefixo as Tabela;
  throw new Error(`Referência do manifesto sem contrato de existência: ${chave}. Atualize o mapa antes de retomar.`);
}
/** Só existência: edição legítima por UI não é apagada nem tratada como divergência de conteúdo. */
export async function verificarReferenciasPg(cliente: { query(sql: string, valores: string[][]): Promise<{ rows: Array<{ id: string }> }> }, manifesto: Pick<Manifesto, 'ids'>) {
  const grupos = new Map<Tabela, Array<{ chave: string; id: string }>>();
  for (const [chave, id] of Object.entries(manifesto.ids)) {
    const tabela = tabelaReferencia(chave); if (!tabela) continue;
    const refs = grupos.get(tabela) ?? []; refs.push({ chave, id }); grupos.set(tabela, refs);
  }
  for (const [tabela, refs] of grupos) {
    const resultado = await cliente.query(`SELECT "id"::text AS id FROM ${tabelas[tabela]} WHERE "id"::text = ANY($1::text[])`, [[...new Set(refs.map(r => r.id))]]);
    const existentes = new Set(resultado.rows.map(r => r.id));
    const removida = refs.find(r => !existentes.has(r.id));
    if (removida) throw new Error(`Referência removida ou divergente: ${removida.chave} (${removida.id}). A retomada foi interrompida antes de qualquer escrita; nenhum fato será recriado.`);
  }
}
