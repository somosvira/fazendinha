import { prisma } from '../../../src/db.js';
import type { Contexto } from '../contexto.js';
import { criarFormatoQualidade, listarFormatosQualidade, registrarQualidade, corrigirQualidade } from '../../../src/services/pecuaria/leite/qualidade.js';
import { criarFormatoQualidadeSchema, registrarQualidadeSchema, corrigirQualidadeSchema } from '../../../src/services/pecuaria/leite/qualidade.schemas.js';
import { consultarFolha } from '../../../src/services/pecuaria/leite/producao.js';
import { AVISO, CAMPOS, calendario, key, nome, ref } from './catalogo.js';
import { executar, guardar, id, sitio, uid } from './base.js';
export async function qualidade(c: Contexto, periodo: 'anterior' | 'atual') {
  await executar(c, 'formato', () => criarFormatoQualidade(criarFormatoQualidadeSchema.parse({ chave: key('formato'), nome: nome('Qualidade demonstrativa'),
    campos: [...CAMPOS.map(([codigo, rotulo, unidade]) => ({ codigo, rotulo, unidade, tipo: 'NUMERO', obrigatorio: true })),
      { codigo: 'OBSERVACAO', rotulo: 'Observação', tipo: 'TEXTO' }, { codigo: 'AMOSTRA_INTEGRA', rotulo: 'Amostra íntegra', tipo: 'BOOLEANO' },
      { codigo: 'METODO', rotulo: 'Método demonstrativo', tipo: 'OPCAO', opcoes: ['ROTINA', 'CONTRAPROVA'] }],
  }), uid(c)));
  const cal = calendario(c.manifesto.dataBase), data = periodo === 'anterior' ? cal.anterior : cal.controle;
  const formato = (await listarFormatosQualidade(true)).find(f => f.id === id(c, 'formato'))!;
  const folha = await consultarFolha(sitio(c), data);
  const animal = folha.animais.find(a => a.lactacaoId && !a.excluidoEm);
  if (!animal) throw new Error('Qualidade individual exige animal existente no sítio/data.');
  if (!c.manifesto.ids[ref('animal:qualidade')]) await guardar(c, 'animal:qualidade', animal.animalId);
  for (const [indice, tipo] of [...Array.from({length:12},()=> 'individual'),...Array.from({length:4},()=> 'coletiva'), ...(periodo === 'atual' ? ['pendente', 'anulada'] : [])].entries()) {
    const n = `qualidade:${periodo}:${tipo}${tipo==='individual' && indice>0 ? `:${indice}` : tipo==='coletiva' && indice>12 ? `:${indice-12}` : ''}`;
    const individual = folha.animais.filter(a=>a.lactacaoId&&!a.excluidoEm)[indice % folha.animais.filter(a=>a.lactacaoId&&!a.excluidoEm).length];
    await executar(c, n, () => registrarQualidade(registrarQualidadeSchema.parse({ chave: key(n), propriedadeId: sitio(c), data,
      tipoExameId: formato.id, formatoExameHash: formato.formatoExameHash,
      sujeito: tipo === 'individual' ? { tipo: 'ANIMAL', animalId: individual.animalId } : { tipo: 'COLETIVO', origem: nome('Tanque principal — amostra sintética') },
      resultados: tipo === 'pendente' ? [] : [...CAMPOS.map(([campo, , , valor]) => ({ campo, valor })), { campo: 'OBSERVACAO', valor: AVISO }, { campo: 'AMOSTRA_INTEGRA', valor: true }, { campo: 'METODO', valor: 'ROTINA' }],
      responsavel: 'Laboratório demonstrativo', anotacaoOriginal: AVISO, dataResultadoLaboratorial: tipo === 'pendente' ? null : data, dataRecebimentoLaudo: tipo === 'pendente' ? null : data,
    }), uid(c)));
  }
  if (periodo === 'atual') {
    await executar(c, 'qualidade:correcao', async () => {
      const a = await prisma.amostraQualidadeLeite.findUniqueOrThrow({ where: { id: id(c, 'qualidade:atual:individual') } });
      return corrigirQualidade(a.id, corrigirQualidadeSchema.parse({ chave: key('qualidade:correcao'), propriedadeId: sitio(c), versaoEsperada: a.versao, motivo: AVISO,
        resultados: CAMPOS.map(([campo, , , valor]) => ({ campo, valor: campo === 'CCS' ? 230 : valor })) }), uid(c));
    });
    await executar(c, 'qualidade:anular', async () => {
      const a = await prisma.amostraQualidadeLeite.findUniqueOrThrow({ where: { id: id(c, 'qualidade:atual:anulada') } });
      return corrigirQualidade(a.id, corrigirQualidadeSchema.parse({ chave: key('qualidade:anular'), propriedadeId: sitio(c), versaoEsperada: a.versao, motivo: AVISO, anular: true }), uid(c));
    });
    await executar(c, 'formato:v2', () => criarFormatoQualidade(criarFormatoQualidadeSchema.parse({ chave: key('formato:v2'), nome: nome('Qualidade demonstrativa · revisão'), campos: [...formato.campos, { codigo: 'TEMPERATURA', tipo: 'NUMERO', rotulo: 'Temperatura da amostra', unidade: '°C' }] }), uid(c), formato.id));
  }
}
