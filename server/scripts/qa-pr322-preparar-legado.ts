// Fixture técnica aditiva. Não executa carga, reset, backup ou alteração de constraints.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { exigirPreparacaoAntigaDisponivel } from '../prisma/seedatev3/retomada-local.js';
import { prisma } from '../src/db.js';
import { auditar } from '../src/services/pecuaria/rebanho/regras.js';
const url = new URL(process.env.DATABASE_URL ?? '');
exigirPreparacaoAntigaDisponivel();
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/fazendinha_seedatev3') throw Error('Somente fazendinha_seedatev3 local é permitido');
const arquivo = process.argv.find(a => a.startsWith('--arquivo='))?.slice(10);
if (!arquivo) throw Error('Informe --arquivo com o registro local de fixtures QA322');
const path = resolve(arquivo), f = JSON.parse(await readFile(path, 'utf8'));
if (!String(f.execucao).startsWith('QA322-') || !f.animalLegado?.id || !f.tentativaClinica?.tentativaId) throw Error('Registro de fixtures clínicas incompleto');
try {
  f.gestacaoLegado = await prisma.$transaction(async tx => {
    const sitio = await tx.propriedade.findUniqueOrThrow({ where: { id: f.sitioA.id } });
    const animal = await tx.animal.findUniqueOrThrow({ where: { id: f.animalLegado.id } });
    const tentativa = await tx.tentativaReprodutiva.findUniqueOrThrow({ where: { id: f.tentativaClinica.tentativaId } });
    if (!sitio.nome.startsWith('QA322-') || !['QA322-07', 'QA322-08'].includes(animal.brinco) || tentativa.animalId !== animal.id || tentativa.propriedadeId !== sitio.id) throw Error('Alvo fora das fixtures próprias');
    const referenciaExterna = f.execucao + ':gestacao-legado:' + animal.id;
    const anterior = await tx.gestacaoAnimal.findUnique({ where: { referenciaExterna } });
    if (anterior) return { id: anterior.id, animalId: anterior.animalId, referenciaExterna };
    if (await tx.gestacaoAnimal.count({ where: { animalId: animal.id } })) throw Error('Não sobrescrever gestação existente');
    const confirmadaEm = new Date(f.dataBase + 'T00:00:00Z'); confirmadaEm.setUTCDate(confirmadaEm.getUTCDate() - 56);
    const g = await tx.gestacaoAnimal.create({ data: { animalId: animal.id, propriedadeId: sitio.id, tentativaId: tentativa.id, inicio: tentativa.data, confirmadaEm, origem: 'DOCUMENTADA', referenciaExterna, criadoPorId: animal.criadoPorId } });
    await auditar(tx, { entidade: 'GestacaoAnimal', entidadeId: g.id, animalId: animal.id, propriedadeId: sitio.id, acao: 'PREPARACAO_FIXTURE_QA322', usuarioId: animal.criadoPorId, depois: { fixture: f.execucao, gestacaoId: g.id, observacao: 'Legado fictício anterior ao primeiro DG. Dados originais preservados.' } });
    return { id: g.id, animalId: g.animalId, referenciaExterna };
  });
  await writeFile(path, JSON.stringify(f, null, 2) + '\n');
  console.log(JSON.stringify({ gestacaoId: f.gestacaoLegado.id, preparacao: 'Fixture própria; demais passos pela API/UI reais' }));
} finally { await prisma.$disconnect(); }
