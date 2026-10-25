import { writeFile } from 'node:fs/promises';
import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { registrarConferenciaSaldoLeite } from '../../../src/services/pecuaria/leite/conferencias-saldo.js';
import { criarProgramacaoRetirada } from '../../../src/services/pecuaria/leite/programacao.js';
import { emitirRelatorioLeite, obterRelatorioLeite } from '../../../src/services/pecuaria/leite/relatoriosleite.js';
import { csvSnapshotLeite } from '../../../src/services/pecuaria/leite/relatoriosleite.calc.js';
import { preverHistoricoLeite } from '../../../src/services/pecuaria/leite/previa.js';
import { previaHistoricaLeiteSchema } from '../../../src/services/pecuaria/leite/previa.schemas.js';
import { AVISO, calendario, key } from './catalogo.js';
import { executar, id, sitio, uid } from './base.js';
export async function relatorios(c: Contexto, pasta: string) {
  const cal = calendario(c.manifesto.dataBase);
  for (const [n, versao, litros] of [['conferencia', 0, 120], ['conferencia:correcao', 1, 118]] as const)
    await executar(c, n, () => registrarConferenciaSaldoLeite({ chave: key(n), propriedadeId: sitio(c), produtoId: id(c, 'produto:comercial'), data: cal.hoje,
      litrosObservados: litros, referencia: AVISO, responsavel: 'Equipe demonstrativa V5', versaoEsperada: versao, ...(versao ? { motivoCorrecao: AVISO } : {}) }, uid(c)));
  // Os quatro modos são versões futuras; a vigência atual permanece diária.
  for (const [i, extra] of [
    { tipo: 'DIARIA' as const }, { tipo: 'SEMANAL' as const, diaSemana: 1 },
    { tipo: 'DIAS_ESCOLHIDOS' as const, diasSemana: [1, 3, 5] }, { tipo: 'META_LITROS' as const, produtoId: id(c, 'produto:comercial'), metaLitros: 500 },
  ].entries()) await executar(c, `programacao:${i}`, () => criarProgramacaoRetirada({ chave: key(`programacao:${i}`), propriedadeId: sitio(c), vigenteDesde: c.dias(i * 7), versaoEsperada: i, ...extra }, uid(c)));
  for (const incluirValores of [false, true]) {
    const n = `relatorio:${incluirValores}`;
    await executar(c, n, () => emitirRelatorioLeite({ chave: key(n), propriedadeId: sitio(c), inicio: cal.inicioAtual, fim: cal.hoje, incluirValores }, uid(c), true));
    const emissao = await obterRelatorioLeite(id(c, n), sitio(c), true);
    // O exportador operacional publica no R2; a seed local só serializa o snapshot.
    await writeFile(`${pasta}/leite-${id(c, n)}.csv`, csvSnapshotLeite(emissao), { mode: 0o600 });
  }
  const animal = await prisma.animal.findUniqueOrThrow({ where: { id: id(c, 'animal:qualidade') } });
  const input = previaHistoricaLeiteSchema.parse({ inicio: cal.inicioAtual, fim: cal.hoje, unidade: 'L', referenciaUnidade: AVISO, origemArquivo: 'V5-sintetico.json', linhas: [
    { origemId: 'controle-existente', brinco: animal.brinco, data: cal.controle, ordenha: 'Manhã', estado: 'MEDIDO', litros: 8, responsavelFonte: 'Equipe demonstrativa V5' },
    { origemId: 'animal-inexistente', brinco: 'V5-NAO-CADASTRADO', data: cal.hoje, ordenha: 'Manhã', estado: 'PENDENTE', litros: null },
  ] });
  await writeFile(`${pasta}/previa-historica-entrada.json`, JSON.stringify(input, null, 2));
  await writeFile(`${pasta}/previa-historica-resultado.json`, JSON.stringify(await preverHistoricoLeite(sitio(c), input), null, 2));
  await writeFile(`${pasta}/laudo-demonstrativo.xml`, `<?xml version="1.0"?><laudo><aviso>${AVISO}</aviso><data>${cal.hoje}</data><ccs unidade="mil celulas/mL">240</ccs></laudo>`);
}
