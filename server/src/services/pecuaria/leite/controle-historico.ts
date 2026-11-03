import { hashDados } from "../reproducao/operacoes.js";
import { Prisma, type ControleHistoricoLeite } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../../db.js";
import { conferirSitioLeiteTx } from "./configuracoes.js";
import { consultarControlesColetivosSchema, type ConsultaControlesColetivos } from "./historico.schemas.js";
import type { ControleHistoricoLeiteDTO } from "./controle-historico.contratos.js";
import { controleHistoricoLeiteSchema, resumirControleHistorico, type ControleHistoricoLeiteInput } from "./controle-historico.calc.js";
import { validarContextoControleHistoricoLeiteTx } from "./controle-historico-contexto.js";
import { auditar, RebanhoError, travarAnimais } from "../rebanho/regras.js";
export interface FonteControleHistorico {
    bancoOrigem: string;
    chaveOrigem: string;
    registro: ControleHistoricoLeiteInput;
}
export interface RevisaoControleHistorico {
    operacao?: "CRIAR" | "VINCULAR" | "CORRIGIR";
    destinoId?: string;
    motivo?: string;
    versaoEsperada?: number;
    duplicidadesRevisadas?: string[];
}
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const igual = (a: unknown, b: unknown) => hashDados(a) === hashDados(b);
function dadosPersistidos(d: ControleHistoricoLeiteInput) { return { tipo: d.tipo, inicio: new Date(d.inicio), fim: new Date(d.fim), contextoHistorico: d.contexto, animalId: d.animalId, propriedadeId: d.propriedadeId, lactacaoId: d.lactacaoId ?? null, origemColetiva: d.origemColetiva ?? null, total: d.total === null ? null : new Prisma.Decimal(d.total), unidade: d.unidade, referenciaUnidade: d.referenciaUnidade, parcelas: json(d.parcelas) }; }
export async function prepararControleHistoricoLeiteTx(tx: Prisma.TransactionClient, input: FonteControleHistorico, usuarioId: number, opcoes: RevisaoControleHistorico = {}) {
    const dados = controleHistoricoLeiteSchema.parse(input.registro);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0 || !await tx.usuario.findUnique({ where: { id: usuarioId }, select: { id: true } }))
        throw new RebanhoError("VALIDACAO", "Histórico exige usuário real identificado");
    const referencia = JSON.stringify([input.bancoOrigem, input.chaveOrigem]);
    const existente = await tx.controleHistoricoLeite.findUnique({ where: opcoes.destinoId ? { id: opcoes.destinoId } : { referenciaHistorica: referencia } });
    if (existente) {
        const origem = existente.provenienciaSnapshot as {
            dados?: unknown;
            usuarioId?: number;
        };
        if (opcoes.operacao === "CORRIGIR") {
            if (!opcoes.motivo || opcoes.motivo.trim().length < 5 || opcoes.versaoEsperada !== existente.versao || existente.referenciaHistorica !== referencia)
                throw new RebanhoError("CONFLITO", "Correção exige origem, versão e motivo conferidos");
            if (existente.animalId !== dados.animalId || existente.propriedadeId !== dados.propriedadeId || existente.tipo !== dados.tipo || existente.inicio.toISOString().slice(0, 10) !== dados.inicio || existente.fim.toISOString().slice(0, 10) !== dados.fim)
                throw new RebanhoError("CONFLITO", "Correção documental conserva sujeito, sítio e período; reconcilie a identidade separadamente");
        }
        else if (!igual(origem.dados, dados) || (opcoes.operacao !== "VINCULAR" && origem.usuarioId !== usuarioId))
            throw new RebanhoError("CONFLITO", "Origem histórica já registrada com outros dados/autoria");
    }
    const lactacao = await validarContextoControleHistoricoLeiteTx(tx, dados);
    if (!dados.animalId && dados.propriedadeId !== null && !await tx.propriedade.findUnique({ where: { id: dados.propriedadeId }, select: { id: true } }))
        throw new RebanhoError("NAO_ENCONTRADO", "Sítio não encontrado");
    const candidatos = existente ? [] : await tx.controleHistoricoLeite.findMany({ where: { animalId: dados.animalId, propriedadeId: dados.propriedadeId, inicio: new Date(dados.inicio), fim: new Date(dados.fim), tipo: dados.tipo }, select: { id: true } });
    return { dados, referencia, existenteId: existente?.id ?? null, candidatosDuplicidade: candidatos.map(c => c.id), contexto: { lactacao, semLactacaoComprovada: dados.animalId !== null && !dados.lactacaoId, versao: existente?.versao ?? null }, resumo: resumirControleHistorico(dados) };
}
export async function registrarControleHistoricoLeiteTx(tx: Prisma.TransactionClient, input: FonteControleHistorico, usuarioId: number, opcoes: RevisaoControleHistorico = {}) {
    if (input.registro.animalId)
        await travarAnimais(tx, [input.registro.animalId]);
    const previa = await prepararControleHistoricoLeiteTx(tx, input, usuarioId, opcoes);
    if (opcoes.operacao === "VINCULAR") {
        if (!previa.existenteId)
            throw new RebanhoError("CONFLITO", "Informe controle existente compatível para vincular");
        return { id: previa.existenteId };
    }
    if (previa.existenteId && opcoes.operacao !== "CORRIGIR")
        return { id: previa.existenteId };
    if (previa.candidatosDuplicidade.some(id => !opcoes.duplicidadesRevisadas?.includes(id)) || previa.candidatosDuplicidade.length && (!opcoes.motivo || opcoes.motivo.trim().length < 5))
        throw new RebanhoError("CONFLITO", "Revise candidatos a duplicidade e justifique fatos distintos antes de criar");
    const snapshot = { dados: previa.dados, usuarioId, bancoOrigem: input.bancoOrigem, chaveOrigem: input.chaveOrigem, regra: "HISTORICO_DOCUMENTAL_SEM_ESTOQUE_V1", resumo: previa.resumo, duplicidadesRevisadas: opcoes.duplicidadesRevisadas ?? [], motivo: opcoes.motivo ?? null };
    if (opcoes.operacao === "CORRIGIR") {
        if (!previa.existenteId)
            throw new RebanhoError("CONFLITO", "Controle histórico não encontrado para corrigir");
        const antes = await tx.controleHistoricoLeite.findUniqueOrThrow({ where: { id: previa.existenteId } });
        const afetados = await tx.controleHistoricoLeite.updateMany({ where: { id: antes.id, versao: opcoes.versaoEsperada }, data: { ...dadosPersistidos(previa.dados), provenienciaSnapshot: json(snapshot), versao: { increment: 1 } } });
        if (afetados.count !== 1)
            throw new RebanhoError("CONFLITO", "Controle alterado simultaneamente");
        const depois = await tx.controleHistoricoLeite.findUniqueOrThrow({ where: { id: antes.id } });
        await auditar(tx, { entidade: "ControleHistoricoLeite", entidadeId: antes.id, animalId: antes.animalId, propriedadeId: antes.propriedadeId, acao: "CORRECAO_HISTORICA", usuarioId, antes, depois: { ...depois, motivo: opcoes.motivo } });
        return { id: antes.id };
    }
    const r = await tx.controleHistoricoLeite.create({ data: { ...dadosPersistidos(previa.dados), referenciaHistorica: previa.referencia, provenienciaSnapshot: json(snapshot), criadoPorId: usuarioId } });
    await auditar(tx, { entidade: "ControleHistoricoLeite", entidadeId: r.id, animalId: r.animalId, propriedadeId: r.propriedadeId, acao: "IMPORTACAO", usuarioId, depois: r });
    return { id: r.id };
}

/** Documentos históricos permanecem separados da série diária e dos seus totais.
 * Esta leitura só retorna o sítio comprovado, sem atribuir documentos externos. */
const parcelasDocumentaisSchema = z.array(z.object({ rotulo: z.string().nullable(), hora: z.string().nullable(), quantidade: z.number().finite().nonnegative().nullable() }));
const origemDocumentalSchema = z.object({
 bancoOrigem: z.string().nullish(), chaveOrigem: z.string().nullish(),
 dados: z.object({ evidencia: z.string().nullish() }).nullish(),
});
function controleDocumentalDTO(r: ControleHistoricoLeite): ControleHistoricoLeiteDTO {
 const origem = origemDocumentalSchema.safeParse(r.provenienciaSnapshot);
 return {
  id:r.id,tipo:z.enum(["CONTROLE_PERIODICO","AGREGADO_MENSAL"]).parse(r.tipo),
  inicio:r.inicio.toISOString().slice(0,10),fim:r.fim.toISOString().slice(0,10),total:r.total?.toString()??null,
  unidade:z.enum(["L","KG"]).parse(r.unidade),referenciaUnidade:r.referenciaUnidade,
  parcelas:parcelasDocumentaisSchema.parse(r.parcelas),lactacaoId:r.lactacaoId,origemColetiva:r.origemColetiva,
  versao:r.versao,contexto:z.enum(["INTERNO","EXTERNO"]).parse(r.contextoHistorico),semEfeitoEstoqueFinanceiro:true,
  origem:{banco:origem.success?origem.data.bancoOrigem??null:null,chave:origem.success?origem.data.chaveOrigem??null:null,
   evidencia:origem.success?origem.data.dados?.evidencia??null:null},
 };
}
export async function consultarControlesHistoricosLeiteTx(tx:Prisma.TransactionClient,propriedadeId:number,animalId:string,inicio:string,fim:string): Promise<ControleHistoricoLeiteDTO[]> {
 const registros=await tx.controleHistoricoLeite.findMany({where:{propriedadeId,animalId,inicio:{lte:new Date(fim)},fim:{gte:new Date(inicio)}},orderBy:[{inicio:"desc"},{id:"asc"}]});
 return registros.map(controleDocumentalDTO);
}

export async function consultarControlesColetivosLeiteTx(tx: Prisma.TransactionClient, propriedadeId: number, input: ConsultaControlesColetivos) {
 const filtro=consultarControlesColetivosSchema.parse(input);
 await conferirSitioLeiteTx(tx,propriedadeId);
 const where:Prisma.ControleHistoricoLeiteWhereInput={propriedadeId,contextoHistorico:"INTERNO",tipo:"AGREGADO_MENSAL",animalId:null,inicio:{lte:new Date(filtro.fim)},fim:{gte:new Date(filtro.inicio)}};
 const [registros,total]=await Promise.all([
  tx.controleHistoricoLeite.findMany({where,orderBy:[{inicio:"desc"},{id:"asc"}],skip:(filtro.pagina-1)*filtro.tamanho,take:filtro.tamanho}),
  tx.controleHistoricoLeite.count({where}),
 ]);
 return {propriedadeId,periodo:{inicio:filtro.inicio,fim:filtro.fim},itens:registros.map(controleDocumentalDTO),total,pagina:filtro.pagina,tamanho:filtro.tamanho};
}
export function consultarControlesColetivosLeite(propriedadeId:number,filtro:ConsultaControlesColetivos) {
 return prisma.$transaction(tx=>consultarControlesColetivosLeiteTx(tx,propriedadeId,filtro),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
}
