import type { Prisma } from "@prisma/client";
import { obterElegibilidadesNaDataTx } from "./elegibilidade.js";
import type { AnimalSelecao } from "./selecoes.calc.js";

const diaTexto = (data: Date) => data.toISOString().slice(0, 10);
/** Projeção somente para seleção livre; não altera assinaturas de prévias antigas. */
export async function ampliarContextosSelecaoTx(tx: Prisma.TransactionClient, contextos: Map<string, AnimalSelecao>, propriedadeId: number, referencia: Date) {
  const ids = [...contextos.keys()], data = diaTexto(referencia);
  const [animais, pesagens, composicoes, participacoes, elegibilidades] = await Promise.all([
    tx.animal.findMany({ where: { id: { in: ids } } }),
    tx.pesagem.findMany({ where: { animalId: { in: ids }, data: { lte: referencia } }, orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "asc" }] }),
    tx.composicaoRacial.findMany({ where: { animalId: { in: ids } }, include: { raca: true } }),
    tx.participacaoProtocolo.findMany({ where: { animalId: { in: ids }, propriedadeId }, include: { protocolo: { select: { id: true, nome: true, tipo: true } }, tarefas: { select: { realizadaEm: true, dispensadaEm: true, regularizacaoPendente: true, aplicacoes: { where: { status: "VALIDO" }, select: { data: true } }, exames: { where: { status: "VALIDO" }, select: { data: true } } } } } }),
    obterElegibilidadesNaDataTx(tx, ids, propriedadeId, referencia),
  ]);
  const dias = (d: Date) => Math.floor((referencia.getTime() - d.getTime()) / 86400000);
  const ocorrida = (d: Date | null) => !!d && diaTexto(d) <= data;
  const animaisPorId = new Map(animais.map(a => [a.id, a]));
  const pesos = new Map<string, typeof pesagens[number]>();
  for (const peso of pesagens) if (!pesos.has(peso.animalId)) pesos.set(peso.animalId, peso);
  for (const [id, contexto] of contextos) {
    const animal = animaisPorId.get(id)!;
    const peso = pesos.get(id), elegibilidade = elegibilidades.get(id);
    const composicao = composicoes.filter(c => c.animalId === id);
    // Composição atual não possui revisões históricas. Mudança posterior torna o passado desconhecido.
    const racasConhecidas = composicao.length > 0 && composicao.every(c => diaTexto(c.criadoEm) <= data && diaTexto(c.atualizadoEm) <= data);
    const ativos = participacoes.filter(p => p.animalId === id && ocorrida(p.protocolo.tipo === "SANITARIO" ? p.inicio : p.inicioEfetivo) && !ocorrida(p.canceladaEm)
      && (p.tarefas.length === 0 || p.tarefas.some(t => t.regularizacaoPendente || !(ocorrida(t.realizadaEm) || ocorrida(t.dispensadaEm) || t.aplicacoes.some(a => ocorrida(a.data)) || t.exames.some(e => ocorrida(e.data))))));
    const dominios = [...new Set(ativos.map(p => p.protocolo.tipo))];
    Object.assign(contexto, {
      identificacao: `${animal.brinco} ${animal.nome ?? ""}`, origem: animal.origem, sexo: animal.sexo,
      nascimentoEstimado: animal.nascimentoEstimado ? "SIM" : "NAO", idadeDias: dias(animal.dataNascimento),
      dataNascimento: diaTexto(animal.dataNascimento),
      diasAptidao: elegibilidade?.aptaDesde && elegibilidade.aptaDesde <= data ? dias(new Date(`${elegibilidade.aptaDesde}T00:00:00.000Z`)) : null,
      elegibilidade: elegibilidade ? { estado: elegibilidade.estado, aptaDesde: elegibilidade.aptaDesde } : null,
      pesoKg: peso ? Number(peso.pesoKg) : null, pesagemData: peso ? diaTexto(peso.data) : null, diasPesagem: peso ? dias(peso.data) : null,
      racas: racasConhecidas ? composicao.filter(c => c.fracao64 > 0).map(c => c.racaId) : null,
      composicaoSelecao: racasConhecidas ? composicao.map(c => ({ racaId: c.racaId, nome: c.raca.nome, fracao64: c.fracao64 })) : null,
      protocolosAtivos: ativos.map(p => p.protocoloId),
      dominiosAtivos: dominios.length ? ["QUALQUER", ...dominios, ...(dominios.length === 2 ? ["AMBOS"] : [])] : ["NENHUM"],
      participacoesAtivas: ativos.map(p => ({ id: p.id, protocoloId: p.protocoloId, nome: p.protocolo.nome, tipo: p.protocolo.tipo })),
      historicoParto: (contexto.ultimoParto || Number(contexto.partos) > 0 || animal.partosAntesDaEntrada > 0) ? "CONHECIDO" : "SEM_REGISTRO", versaoSelecao: 2,
    });
  }
  return contextos;
}

export async function referenciasFiltrosSelecaoTx(tx: Prisma.TransactionClient, criterios: import("./selecoes.schemas.js").CriteriosSelecao, propriedadeId: number) {
  const condicoes = [...criterios.todas, ...criterios.qualquer.flatMap(b => b.todas)];
  const ids = (campo: string) => condicoes.flatMap(c => c.tipo === "VALORES" && c.campo === campo ? c.valores : []).filter(v => /^[a-f0-9-]{36}$/i.test(v));
  const [lotes, categorias, racas, protocolos] = await Promise.all([
    tx.lote.findMany({ where: { id: { in: ids("LOTE") }, propriedadeId }, select: { id: true, nome: true } }),
    tx.categoriaAnimal.findMany({ where: { id: { in: ids("CATEGORIA") } }, select: { id: true, nome: true } }),
    tx.raca.findMany({ where: { id: { in: ids("RACA") } }, select: { id: true, nome: true } }),
    tx.protocolo.findMany({ where: { id: { in: ids("PROTOCOLO") } }, select: { id: true, nome: true } }),
  ]);
  return [...lotes, ...categorias, ...racas, ...protocolos];
}
