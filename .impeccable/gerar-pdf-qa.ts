import { writeFileSync, mkdirSync } from "node:fs";
import { comporItens, type OperacaoComposicao, type SnapshotRelatorio } from "../server/src/services/financeiro/relatorios.calc.js";
import { gerarPdfRelatorio } from "../server/src/services/financeiro/relatorios.pdf.js";
import { uid } from "../server/src/lib/uid.fixture.js";
function operacoes(quantidade: number): OperacaoComposicao[] {
  return Array.from({ length: quantidade }, (_, i) => ({
    id: uid(i + 1), numero: i + 1, data: new Date("2026-09-02T00:00:00Z"), tipo: "SERVICO", status: "CONFIRMADA", descricao: `Serviço (${i + 1}) de manutenção`, valorTotal: "150.00",
    centroCustoId: uid(1), centroCusto: { nome: "Pecuária" }, parceiro: null, categoriaId: uid(2), categoriaNome: "Manutenção", classificacao: "CUSTEIO", itens: [],
  }));
}

function snapshot(quantidade = 3): SnapshotRelatorio {
  return {
    versao: 1, nome: "Fechamento de setembro", geradoEm: "2026-09-14T12:00:00.000Z", autor: "Rafael Toledo", propriedade: { id: 1, nome: "Fazenda Rio Novo" },
    configuracao: { nome: "Fechamento de setembro", dataInicio: "2026-09-01", dataFim: "2026-09-30", regime: "ambos", tipos: [], status: [], centroCustoIds: [], parceiroIds: [], categoriaIds: [uid(2)], classificacoes: [] },
    filtros: { tipos: [], status: [], centrosCusto: [], categorias: ["Manutenção"], classificacoes: [] },
    gerencial: {
      meta: { geradoEm: "2026-09-14T12:00:00.000Z", propriedade: { id: 1, nome: "Fazenda Rio Novo" }, periodo: { inicio: "2026-09-01", fim: "2026-09-30" }, regime: "ambos", hoje: "2026-09-14" },
      resumo: { entradas: 0, saidas: 450, resultado: -450, saldoContasFinal: 10000, nLancamentos: 3, aPagar: 0, aReceber: 0 },
      saldoContas: { contas: [{ id: uid(1), nome: "Banco do Brasil", banco: null, saldoInicial: 10450, entradas: 0, saidas: 450, saldoFinal: 10000 }], total: { saldoInicial: 10450, entradas: 0, saidas: 450, saldoFinal: 10000 } },
      entradasSaidas: { meses: [{ mes: "2026-09", entradas: 0, saidas: 450, resultado: -450 }], total: { entradas: 0, saidas: 450, resultado: -450 } },
      resultado: { receita: 0, custeio: 450, investimento: 0, resultado: -450, porAtividade: [] },
      compromissos: { hoje: "2026-09-14", aPagar: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] }, aReceber: { total: 0, vencido: 0, aVencer: 0, quantidade: 0, itens: [] } },
      categorias: { itens: [{ categoria: "Manutenção", total: 450, pct: 100 }], centros: [{ centro: "Pecuária", total: 450, pct: 100 }] },
      operacoes: [],
      rastreabilidade: { totalLancamentos: 3, estornados: 0, comDocumento: 1, semDocumento: 2, comNotaFiscal: 0, semNotaFiscal: 3, semCentroCusto: 0, mesesFechados: [], mesesAbertos: ["2026-09"] },
    },
    composicao: comporItens(operacoes(quantidade)),
  };
}


const base = snapshot();
base.nome = "Validação local do PDF - dados fictícios";
base.autor = "QA local";
base.propriedade.nome = "Fazenda fictícia de QA";
base.filtros.categorias = Array.from({length:45},(_,i)=>"Categoria fictícia de insumos e manutenção com nome extenso "+(i+1));
const destino = "/mnt/c/Users/mathe/.codex/visualizations/2026/10/15/validacoes-locais";
mkdirSync(destino,{recursive:true});
writeFileSync(destino+"/relatorio-qa.pdf", gerarPdfRelatorio(base));
console.log("PDF fictício gerado pelo gerador real; nenhum banco ou storage acessado.");

