import { prisma } from '../../src/db.js';
import { reconhecerInsercaoDispositivo } from '../../src/services/pecuaria/protocolos/manejos-correcao.js';
import type { Contexto } from '../seedatev3/contexto.js';
import { AVISO } from './catalogo.js';
import { acao, key, sitio, uid } from './base.js';
import { exigirUnico } from './seguranca.js';

export async function prepararRetiradaDemonstrativa(c: Contexto, tarefa: { id: string; participanteId: string; previstaEm: Date }) {
  const origens = await prisma.aplicacaoProduto.findMany({ where: {
    tarefa: { execucaoId: tarefa.participanteId }, propriedadeId: sitio(c), status: 'VALIDO', data: { lte: tarefa.previstaEm },
  } });
  const origem = exigirUnico(origens, `Inserção demonstrativa da tarefa ${tarefa.id}`);
  // Modelos publicados pelo seed anterior não tinham o subtipo; reconhecer o fato preserva a versão e a baixa.
  if (!origem.insercaoDispositivoSnapshot) await acao(c, `reconhecer-insercao:${origem.id}`, () => reconhecerInsercaoDispositivo(tarefa.id, {
    chave: key(`reconhecer-insercao:${origem.id}`), propriedadeId: sitio(c), aplicacaoId: origem.id,
    motivo: 'Reconhecimento explícito da inserção fictícia preparada pelo seed V4.', evidencia: AVISO, cienciaSemNovaBaixa: true,
  }, uid(c)));
  return { observacao: AVISO, insercaoAplicacaoId: origem.id };
}
