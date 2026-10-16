import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prisma } from '../../../src/db.js';
import { cadastrar } from '../../../src/services/pecuaria/rebanho/animais.js';
import { cadastrarAnimalSchema } from '../../../src/services/pecuaria/rebanho/schemas.js';
import { auditar } from '../../../src/services/pecuaria/rebanho/regras.js';
import { cargaSchema, mapeamentoSchema } from '../../import-v4/contrato.js';
import { diretorio, type Contexto } from '../contexto.js';

/** Arquivos sintéticos; nenhuma carga é executada pelo seed. */
export async function prepararImportacaoQa(c: Contexto) {
  const uid = c.numero('usuario:dono'), propriedadeId = c.numero('qa-v4-v1:sitio:A');
  for (const n of [801, 802, 803]) {
    const ref = `qa-v4-v1:importacao:${n}`, brinco = `QA4-${n}`;
    await c.registro(ref, id => prisma.animal.findFirst({ where: id ? { id } : { brinco } }), () => cadastrar(cadastrarAnimalSchema.parse({
      brinco, nome: `QA V4 · Importação sintética ${n}`, sexo: 'F', dataNascimento: c.dias(-1800), dataEntrada: c.dias(-600), origem: 'COMPRADO', partosAntesDaEntrada: n === 803 ? 1 : 0,
      propriedadeId, loteId: c.id('qa-v4-v1:lote:Casos independentes'), aptidao: 'LEITE', composicao: [{ racaId: c.id('raca:HO'), fracao64: 64 }],
    }), uid, { nascimentoHistorico: true }));
    const animalId = c.id(ref);
    await c.acao(`${ref}:origem`, async () => (await prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).ideagriId === 2000000000 + n, () => prisma.$transaction(async tx => {
      const antes = await tx.animal.findUniqueOrThrow({ where: { id: animalId } });
      if (antes.ideagriId != null) throw new Error('Fixture de importação já possui outra identidade; não sobrescrever.');
      if (await tx.animal.count({ where: { ideagriId: 2000000000 + n } })) throw new Error('Identidade sintética ocupada; nenhuma referência será substituída.');
      const depois = await tx.animal.update({ where: { id: animalId }, data: { ideagriId: 2000000000 + n } });
      await auditar(tx, { entidade: 'Animal', entidadeId: animalId, animalId: animalId, propriedadeId, acao: 'FIXTURE_ORIGEM_QA', usuarioId: uid, antes, depois });
    }));
  }
  const fato = { origem: 'IDEAGRI', tipo: 'IA', animalIdeagriId: 2000000801, data: c.dias(-100), hora: null, tentativaChave: null, resultado: null,
    desfecho: null, desfechoOriginal: null, contaParidade: false, anteriorEntrada: false, quantidade: null, criasComReferencia: [], snapshot: { ficticio: 'QA V4' } };
  const fatos = [
    { ...fato, chaveExterna: 'REPRODUCAO:QA-IA' },
    { ...fato, chaveExterna: 'REPRODUCAO:QA-DG', tipo: 'DIAGNOSTICO', data: c.dias(-70), tentativaChave: 'REPRODUCAO:QA-IA', resultado: 'POSITIVO' },
    { ...fato, chaveExterna: 'REPRODUCAO:QA-DG-SEM-VINCULO', animalIdeagriId: 2000000802, tipo: 'DIAGNOSTICO', data: c.dias(-70), resultado: 'POSITIVO' },
    { ...fato, chaveExterna: 'REPRODUCAO:QA-PARTO-ANTERIOR', animalIdeagriId: 2000000803, tipo: 'PARTO', data: c.dias(-700), desfecho: 'VIVO', contaParidade: true, anteriorEntrada: true },
  ];
  const carga = cargaSchema.parse({ versao: 4, origem: 'IDEAGRI', sha256: createHash('sha256').update(JSON.stringify(fatos)).digest('hex'), fatos,
    animais: [801, 802, 803].map(n => ({ id: String(2000000000 + n), partosAntesEntrada: n === 803 ? '1' : '0' })), lactacoes: [], periodos: [],
    protocolos: [{ id: 'QA-PROTOCOLO', nome: 'Histórico incompleto fictício' }], etapas: [], programacoes: [{ id: 'QA-PROGRAMACAO', protocolo: 'QA-PROTOCOLO' }], participacoes: [{ id: 'QA-PARTICIPACAO', animal: '2000000802' }],
    catalogos: { tiposParto: [], motivosSecagem: [] }, relatorio: { totais: { REPRODUCAO: 4 }, porTipo: { IA: 1, DIAGNOSTICO: 2, PARTO: 1 }, pendencias: [{ chave: 'QA-PROTOCOLO', codigo: 'QA_INCOMPLETO', mensagem: 'Sem precisão operacional; apenas arquivo histórico.' }] },
  });
  const mapa = mapeamentoSchema.parse({ bancoOrigem: 'QA_V4_SINTETICO', autorId: uid, saldoAnteriorPorParto: { 'REPRODUCAO:QA-PARTO-ANTERIOR': true } });
  for (const [arquivo, dados] of [['carga-sintetica.json', carga], ['mapa-sintetico.json', mapa]] as const) {
    const caminho = `${diretorio}/qa-v4/${arquivo}`, texto = JSON.stringify(dados, null, 2) + '\n';
    try { await writeFile(caminho, texto, { flag: 'wx', mode: 0o600 }); }
    catch (e) {
      if (!(e instanceof Error && 'code' in e && e.code === 'EEXIST')) throw e;
      if (await readFile(caminho, 'utf8') !== texto) throw new Error(`Arquivo ${arquivo} já alterado; preserve a execução anterior.`);
    }
  }
}
