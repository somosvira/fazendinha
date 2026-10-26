import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../db.js";
import { baixarLeiteTx, classificarEntradaLeiteTx, estornarBaixaLeiteTx, obterClassificacaoEntradaLeiteTx, saldosOrigensLeiteTx } from "../../estoque/leite.js";
import { travarValorizacaoTx } from "../../estoque/valorizacao.js";
import { conferirAnimalNoFato } from "../fatos.js";
import { auditar, hojeFazendaDate, RebanhoError, travarAnimais } from "../rebanho/regras.js";
import { conferirCriaTx, corrigirColostroTx, registrarColostroTx } from "../reproducao/colostro.js";
import { operacaoIdempotenteTx } from "../reproducao/operacoes.js";
import { transacaoPecuaria } from "../transacao.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { repartirDestinoLeite } from "./destinos.calc.js";
import { destinoInternoLeiteSchema, estornoDestinoLeiteSchema, type ConsultaDestinosLeite, type DestinoInternoLeiteInput, type EstornoDestinoLeiteInput } from "./destinos.schemas.js";

const incluirDestino = {
  entrada: { select: { sessaoId: true, movimento: { select: { produtoId: true } } } },
  parcelas: { orderBy: { animalId: "asc" as const }, include: { animal: { select: { brinco: true, nome: true } }, fornecimentoColostro: true } },
} satisfies Prisma.DestinoInternoLeiteInclude;
type Destino = Prisma.DestinoInternoLeiteGetPayload<{ include: typeof incluirDestino }>;
export interface DestinoLeiteDTO {
  id: string; propriedadeId: number; entradaId: string; sessaoId: string; produtoId: string; movimentoId: string;
  data: string; natureza: string; declaracaoOrigem: string; quantidadeLitros: number;
  saldoOrigemAntes: number; saldoOrigemDepois: number; responsavel: string | null; observacao: string | null;
  status: string; versao: number; criadoEm: string; criadoPorId: number | null;
  estornadoEm: string | null; motivoEstorno: string | null; movimentoEstornoId: string | null;
  parcelas: { id: string; animalId: string; brinco: string; nome: string | null; quantidadeLitros: number;
    fornecimentoColostroId: string | null; criaId: string | null; criadoNoDestino: boolean; ativo: boolean }[];
}
export function destinoLeiteDTO(destino: Destino): DestinoLeiteDTO {
  return { id: destino.id, propriedadeId: destino.propriedadeId, entradaId: destino.entradaId, sessaoId: destino.entrada.sessaoId,
    produtoId: destino.entrada.movimento.produtoId, movimentoId: destino.movimentoId, data: destino.data.toISOString().slice(0, 10),
    natureza: destino.natureza, declaracaoOrigem: destino.declaracaoOrigem, quantidadeLitros: destino.quantidadeLitros.toNumber(),
    saldoOrigemAntes: destino.saldoOrigemAntes.toNumber(), saldoOrigemDepois: destino.saldoOrigemDepois.toNumber(),
    responsavel: destino.responsavel, observacao: destino.observacao, status: destino.status, versao: destino.versao,
    criadoEm: destino.criadoEm.toISOString(), criadoPorId: destino.criadoPorId, estornadoEm: destino.estornadoEm?.toISOString() ?? null,
    motivoEstorno: destino.motivoEstorno, movimentoEstornoId: destino.movimentoEstornoId,
    parcelas: destino.parcelas.map(p => ({ id: p.id, animalId: p.animalId, brinco: p.animal.brinco, nome: p.animal.nome,
      quantidadeLitros: p.quantidadeLitros.toNumber(), fornecimentoColostroId: p.fornecimentoColostroId,
      criaId: p.fornecimentoColostro?.criaId ?? null, criadoNoDestino: p.criadoNoDestino, ativo: p.ativo })) };
}
const usuarioReal = (id: number | null) => id != null && id > 0 ? id : null;
function filtroDestinatarios(propriedadeId: number, data: Date, busca: string): Prisma.AnimalWhereInput {
  return { dataNascimento: { lte: data }, dataEntrada: { lte: data }, baixas: { none: { estornadaEm: null, data: { lt: data } } },
    localizacoes: { some: { propriedadeId, desde: { lte: data }, OR: [{ ate: null }, { ate: { gt: data } }, { baixasQueFecharam: { some: { estornadaEm: null, data } } }] } },
    ...(busca ? { OR: [{ brinco: { contains: busca, mode: "insensitive" } }, { nome: { contains: busca, mode: "insensitive" } }] } : {}) };
}
export async function listarOrigensDestino(propriedadeId: number, produtoId: string, data: string) {
  return transacaoPecuaria(async tx => {
    await conferirSitioLeiteTx(tx, propriedadeId);
    const origens = await saldosOrigensLeiteTx(tx, produtoId, propriedadeId, new Date(`${data}T00:00:00Z`));
    const sessoes = await tx.sessaoOrdenha.findMany({ where: { id: { in: origens.map(o => o.entrada.sessaoId) } }, select: { id: true, nome: true } });
    return { propriedadeId, itens: origens.filter(o => o.quantidade.gt(0)).map(o => ({ entradaId: o.entradaId, sessaoId: o.entrada.sessaoId,
      nomeOrdenha: sessoes.find(s => s.id === o.entrada.sessaoId)?.nome ?? null,
      natureza: o.natureza, classificacaoId: o.classificacaoId,
      produtoId, data: o.data, quantidadeDisponivelLitros: o.quantidade.toNumber() })) };
  });
}
export async function listarDestinatarios(propriedadeId: number, dataTexto: string, busca = "", pagina = 1) {
  return transacaoPecuaria(async tx => {
    await conferirSitioLeiteTx(tx, propriedadeId);
    const data = new Date(`${dataTexto}T00:00:00Z`);
    const where = filtroDestinatarios(propriedadeId, data, busca);
    const [animais, total] = await Promise.all([
      tx.animal.findMany({ where, select: { id: true, brinco: true, nome: true, sexo: true }, orderBy: [{ brinco: "asc" }, { id: "asc" }], skip: (pagina - 1) * 10, take: 10 }),
      tx.animal.count({ where }),
    ]);
    const crias = await tx.criaParto.findMany({ where: { animalId: { in: animais.map(a => a.id) }, viva: true } });
    const partos = await tx.partoAnimal.findMany({ where: { id: { in: crias.map(c => c.partoId) }, status: "VALIDO", data: { lte: data } }, select: { id: true } });
    return { itens: animais.map(a => ({ animalId: a.id, brinco: a.brinco, nome: a.nome, sexo: a.sexo,
      criaId: crias.find(c => c.animalId === a.id && partos.some(p => p.id === c.partoId))?.id ?? null })), total, pagina, porPagina: 10 };
  });
}
export async function listarCriasDestino(propriedadeId: number, dataTexto: string, busca = "", pagina = 1) {
  return transacaoPecuaria(async tx => {
    await conferirSitioLeiteTx(tx, propriedadeId);
    const data = new Date(`${dataTexto}T00:00:00Z`);
    // CriaParto conserva animalId/partoId escalares; não há relação Prisma animal→cria.
    const partos = await tx.partoAnimal.findMany({ where: { status: "VALIDO", data: { lte: data } }, select: { id: true } });
    const crias = await tx.criaParto.findMany({ where: { partoId: { in: partos.map(p => p.id) }, viva: true, animalId: { not: null } } });
    const where: Prisma.AnimalWhereInput = { ...filtroDestinatarios(propriedadeId, data, busca), id: { in: crias.flatMap(c => c.animalId ? [c.animalId] : []) } };
    const [animais, total] = await Promise.all([
      tx.animal.findMany({ where, select: { id: true, brinco: true, nome: true }, orderBy: [{ brinco: "asc" }, { id: "asc" }], skip: (pagina - 1) * 10, take: 10 }),
      tx.animal.count({ where }),
    ]);
    const criasPagina = crias.filter(c => animais.some(a => a.id === c.animalId));
    const fornecimentos = await tx.fornecimentoColostro.findMany({ where: { criaId: { in: criasPagina.map(c => c.id) }, propriedadeId,
      data, status: "VALIDO", parcelasDestinoLeite: { none: { ativo: true } } }, orderBy: { criadoEm: "asc" } });
    return { itens: animais.map(a => { const criaId = criasPagina.find(c => c.animalId === a.id)!.id;
      return { criaId, animalId: a.id, brinco: a.brinco, nome: a.nome, fornecimentos: fornecimentos.filter(f => f.criaId === criaId)
        .map(f => ({ id: f.id, data: f.data.toISOString().slice(0, 10), quantidadeLitros: f.quantidadeLitros?.toNumber() ?? null })) }; }), total, pagina, porPagina: 10 };
  });
}
export async function listarDestinos(propriedadeId: number, filtro: ConsultaDestinosLeite) {
  const where: Prisma.DestinoInternoLeiteWhereInput = { propriedadeId,
    ...(filtro.de || filtro.ate ? { data: { ...(filtro.de ? { gte: new Date(`${filtro.de}T00:00:00Z`) } : {}), ...(filtro.ate ? { lte: new Date(`${filtro.ate}T00:00:00Z`) } : {}) } } : {}),
    ...(filtro.animalId ? { parcelas: { some: { animalId: filtro.animalId } } } : {}) };
  const [itens, total] = await Promise.all([
    prisma.destinoInternoLeite.findMany({ where, include: incluirDestino, orderBy: [{ data: "desc" }, { criadoEm: "desc" }], skip: (filtro.pagina - 1) * 20, take: 20 }),
    prisma.destinoInternoLeite.count({ where }),
  ]);
  return { itens: itens.map(destinoLeiteDTO), total, pagina: filtro.pagina, porPagina: 20 };
}
export async function consultarDestino(id: string, propriedadeId: number) {
  const destino = await prisma.destinoInternoLeite.findFirst({ where: { id, propriedadeId }, include: incluirDestino });
  if (!destino) throw new RebanhoError("NAO_ENCONTRADO", "Destino interno não encontrado neste sítio");
  return destinoLeiteDTO(destino);
}
export async function registrarDestinoInterno(input: DestinoInternoLeiteInput, usuarioId: number | null): Promise<DestinoLeiteDTO> {
  input = destinoInternoLeiteSchema.parse(input); usuarioId = usuarioReal(usuarioId);
  return transacaoPecuaria(async tx => {
    await travarAnimais(tx, input.parcelas.map(p => p.animalId));
    return operacaoIdempotenteTx(tx, input, usuarioId, "DESTINO_INTERNO_LEITE", async () => {
      const data = new Date(`${input.data}T00:00:00Z`);
      if (data > hojeFazendaDate()) throw new RebanhoError("VALIDACAO", "O fornecimento deve ter data até hoje", "data");
      await conferirSitioLeiteTx(tx, input.propriedadeId, true);
      const entrada = await tx.entradaProducaoLeite.findFirst({ where: { id: input.entradaId, status: "CONFIRMADA",
        movimento: { propriedadeId: input.propriedadeId, status: "CONFIRMADO" } }, include: { movimento: { include: { produto: true } } } });
      if (!entrada) throw new RebanhoError("NAO_ENCONTRADO", "Produção confirmada não encontrada neste sítio");
      if (entrada.movimento.data > data) throw new RebanhoError("VALIDACAO", "O fornecimento não pode anteceder a origem produzida", "data");
      const produto = entrada.movimento.produto;
      if (!produto.ativo || produto.unidade !== "L" || produto.rastrearPartidas)
        throw new RebanhoError("VALIDACAO", "A origem deve usar produto ativo em litros com rastreio pelas ordenhas", "entradaId");
      await travarValorizacaoTx(tx, [produto.id]);
      const origem = (await saldosOrigensLeiteTx(tx, produto.id, input.propriedadeId, data)).find(o => o.entradaId === entrada.id);
      if (!origem || !origem.quantidade.eq(input.quantidadeDisponivelEsperadaLitros))
        throw new RebanhoError("CONFLITO", "O saldo da origem mudou; recarregue antes de registrar o fornecimento", "quantidadeDisponivelEsperadaLitros");
      const quantidades = repartirDestinoLeite(origem.quantidade, input.parcelas);
      // A declaração é da prática informada. Nenhuma origem é certificada sanitariamente aqui.
      for (const parcela of input.parcelas) {
        await conferirAnimalNoFato(tx, parcela.animalId, input.propriedadeId, data);
        const locais = await tx.localizacaoAnimal.findMany({ where: { animalId: parcela.animalId, desde: { lte: data },
          OR: [{ ate: null }, { ate: { gt: data } }, { baixasQueFecharam: { some: { estornadaEm: null, data } } }] }, select: { id: true, propriedadeId: true } });
        if (locais.length !== 1 || locais[0].propriedadeId !== input.propriedadeId)
          throw new RebanhoError("CONFLITO", "A localização histórica do destinatário exige conciliação antes do fornecimento", "parcelas");
        if (input.natureza !== "COLOSTRO") continue;
        const { animalId } = await conferirCriaTx(tx, parcela.criaId!, input.propriedadeId, data);
        if (animalId !== parcela.animalId) throw new RebanhoError("VALIDACAO", "A cria de parto não corresponde ao animal destinatário", "parcelas");
        if (parcela.fornecimentoColostroId) {
          const fornecimento = await tx.fornecimentoColostro.findFirst({ where: { id: parcela.fornecimentoColostroId, propriedadeId: input.propriedadeId, criaId: parcela.criaId, status: "VALIDO" } });
          if (!fornecimento || fornecimento.data.getTime() !== data.getTime() || !fornecimento.quantidadeLitros?.eq(parcela.quantidadeLitros))
            throw new RebanhoError("CONFLITO", "O fornecimento existente deve corresponder à mesma cria, data, sítio e quantidade", "parcelas");
          if (await tx.parcelaDestinoLeite.findFirst({ where: { fornecimentoColostroId: fornecimento.id, ativo: true }, select: { id: true } }))
            throw new RebanhoError("CONFLITO", "O fornecimento de colostro já possui uma origem de estoque ativa");
        }
      }
      if (input.natureza === "LEITE_COMUM") {
        const classificacao = await obterClassificacaoEntradaLeiteTx(tx, entrada.id);
        if (classificacao?.natureza === "COLOSTRO")
          throw new RebanhoError("CONFLITO", "A origem está declarada como colostro; registre o fornecimento de colostro vinculado à cria real");
      } else {
        await classificarEntradaLeiteTx(tx, { entradaId: entrada.id, natureza: input.natureza === "COLOSTRO" ? "COLOSTRO" : "NAO_COMERCIAL",
          motivo: input.declaracaoOrigem }, { propriedadeId: input.propriedadeId, usuarioId });
      }
      const parcelas = [];
      for (const parcela of input.parcelas) {
        let fornecimentoColostroId = parcela.fornecimentoColostroId ?? null;
        let criadoNoDestino = false;
        if (input.natureza === "COLOSTRO" && !fornecimentoColostroId) {
          const fornecimento = await registrarColostroTx(tx, { chave: randomUUID(), propriedadeId: input.propriedadeId,
            criaId: parcela.criaId!, data: input.data, quantidade: parcela.quantidadeLitros, unidade: "L", responsavel: input.responsavel,
            observacao: input.observacao }, usuarioId);
          fornecimentoColostroId = fornecimento.id; criadoNoDestino = true;
        }
        parcelas.push({ animalId: parcela.animalId, quantidadeLitros: new Prisma.Decimal(parcela.quantidadeLitros), fornecimentoColostroId, criadoNoDestino });
      }
      const movimento = await baixarLeiteTx(tx, { produtoId: produto.id, propriedadeId: input.propriedadeId, data,
        quantidade: quantidades.quantidadeLitros, entradaIds: [entrada.id], origem: "NUTRICAO", usuarioId,
        observacao: `Alimentação interna: ${input.natureza}. ${input.declaracaoOrigem}` });
      const destino = await tx.destinoInternoLeite.create({ data: { chave: input.chave, propriedadeId: input.propriedadeId, entradaId: entrada.id,
        movimentoId: movimento.id, data, natureza: input.natureza, declaracaoOrigem: input.declaracaoOrigem, ...quantidades,
        responsavel: input.responsavel ?? null, observacao: input.observacao ?? null, criadoPorId: usuarioId, parcelas: { create: parcelas } }, include: incluirDestino });
      const dto = destinoLeiteDTO(destino);
      await auditar(tx, { entidade: "DestinoInternoLeite", entidadeId: destino.id, propriedadeId: input.propriedadeId, usuarioId, acao: "CONFIRMACAO", depois: dto });
      for (const parcela of dto.parcelas) await auditar(tx, { entidade: "ParcelaDestinoLeite", entidadeId: parcela.id, animalId: parcela.animalId,
        propriedadeId: input.propriedadeId, usuarioId, acao: "ALIMENTACAO_INTERNA", depois: { ...parcela, destinoId: dto.id, entradaId: dto.entradaId, data: input.data, natureza: input.natureza } });
      return dto;
    });
  });
}
export async function estornarDestinoInterno(id: string, input: EstornoDestinoLeiteInput, usuarioId: number | null): Promise<DestinoLeiteDTO> {
  input = estornoDestinoLeiteSchema.parse(input); usuarioId = usuarioReal(usuarioId);
  return transacaoPecuaria(async tx => {
    const referencia = await tx.destinoInternoLeite.findFirst({ where: { id, propriedadeId: input.propriedadeId }, include: incluirDestino });
    if (!referencia) throw new RebanhoError("NAO_ENCONTRADO", "Destino interno não encontrado neste sítio");
    await travarAnimais(tx, referencia.parcelas.map(p => p.animalId));
    return operacaoIdempotenteTx(tx, { ...input, destinoId: id }, usuarioId, "ESTORNO_DESTINO_LEITE", async () => {
      const atual = await tx.destinoInternoLeite.findFirstOrThrow({ where: { id, propriedadeId: input.propriedadeId }, include: incluirDestino });
      if (atual.status !== "CONFIRMADO" || atual.versao !== input.versaoEsperada)
        throw new RebanhoError("CONFLITO", "O destino mudou ou já foi estornado; atualize o histórico", "versaoEsperada");
      const inverso = await estornarBaixaLeiteTx(tx, { movimentoId: atual.movimentoId, propriedadeId: input.propriedadeId, usuarioId, motivo: input.motivo });
      await tx.parcelaDestinoLeite.updateMany({ where: { destinoId: id, ativo: true }, data: { ativo: false } });
      for (const parcela of atual.parcelas) {
        if (!parcela.criadoNoDestino || !parcela.fornecimentoColostro) continue;
        await corrigirColostroTx(tx, parcela.fornecimentoColostro.id, { chave: randomUUID(), propriedadeId: input.propriedadeId,
          versaoEsperada: parcela.fornecimentoColostro.versao, motivo: input.motivo, anular: true }, usuarioId);
      }
      const depois = await tx.destinoInternoLeite.update({ where: { id, versao: input.versaoEsperada }, data: { status: "ESTORNADO",
        versao: { increment: 1 }, estornadoEm: new Date(), estornadoPorId: usuarioId, motivoEstorno: input.motivo, movimentoEstornoId: inverso.id }, include: incluirDestino });
      const dto = destinoLeiteDTO(depois);
      await auditar(tx, { entidade: "DestinoInternoLeite", entidadeId: id, propriedadeId: input.propriedadeId, usuarioId,
        acao: "ESTORNO", antes: destinoLeiteDTO(atual), depois: dto });
      for (const parcela of dto.parcelas) await auditar(tx, { entidade: "ParcelaDestinoLeite", entidadeId: parcela.id, animalId: parcela.animalId,
        propriedadeId: input.propriedadeId, usuarioId, acao: "ESTORNO_ALIMENTACAO", antes: atual.parcelas.find(p => p.id === parcela.id), depois: { ...parcela, motivo: input.motivo } });
      return dto;
    });
  });
}
