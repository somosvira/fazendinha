import { hashDados } from "../reproducao/operacoes.js";
import { associacaoPesoSecagemHistoricaSchema, prepararAssociacaoPesoSecagemHistoricaTx, registrarAssociacaoPesoSecagemHistoricaTx } from "./peso-secagem.js";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { pesagemHistoricaSchema, prepararPesagemHistoricaTx, registrarPesagemHistoricaTx, validarContextoHistoricoAnimalTx, type ContextoHistoricoAnimalInput } from "./pesagens.js";
import { controleHistoricoLeiteSchema } from "../leite/controle-historico.calc.js";
import { prepararControleHistoricoLeiteTx, registrarControleHistoricoLeiteTx } from "../leite/controle-historico.js";
import { registrarExameTx, type ExameInput, type OrigemHistoricaExame } from "../sanidade/exames.js";
import { criarOcorrenciaTx, encerrarOcorrenciaTx } from "../sanidade/ocorrencias.js";
import { registrarQualidadeTx } from "../leite/qualidade.js";
import { sujeitoQualidadeSchema } from "../leite/qualidade.schemas.js";
import { observacoesExameSchema, validarObservacoesExame } from "../exames/formatos.js";
import { hashFormatoExame } from "../exames/formato-snapshot.js";
import { dataNaoFutura } from "../rebanho/schemas.js";
import { auditar, RebanhoError } from "../rebanho/regras.js";
const texto = (max = 1000) => z.string().trim().min(5).max(max);
const fonte = { bancoOrigem: z.string().trim().min(1).max(120), chaveOrigem: z.string().trim().min(1).max(200) };
const clinico = z.object({ ...fonte, animalId: z.string().uuid(), data: dataNaoFutura, contexto: z.enum(["INTERNO", "EXTERNO"]), propriedadeId: z.number().int().positive().nullable(), evidencia: texto(), snapshotOrigem: z.record(z.unknown()).default({}), responsavel: z.string().trim().max(160).nullish() });
const exame = { tipoExameId: z.string().uuid(), formatoExameHash: z.string().regex(/^[a-f0-9]{64}$/) };
const qualidade = clinico.omit({ animalId: true }).extend({ ...exame, sujeito: sujeitoQualidadeSchema, resultados: observacoesExameSchema, referenciaUnidades: texto(), dataResultadoLaboratorial: dataNaoFutura.nullish(), dataRecebimentoLaudo: dataNaoFutura.nullish() }).strict();
const ecc = clinico.extend({ ...exame, resultadoNumero: z.number().finite().min(1).max(9), escala: z.enum(["1_A_5", "1_A_9"]), referenciaEscala: texto() }).strict();
const mastite = clinico.extend({ doencaId: z.string().uuid(), achadosPorTeto: z.array(z.object({ teto: z.enum(["AD", "AE", "PD", "PE", "NAO_INFORMADO"]), achado: z.string().trim().min(1).max(1000) }).strict()), tratamentos: z.array(z.object({ descricao: texto(2000), produtoOriginal: z.string().max(300).nullable(), doseOriginal: z.string().max(300).nullable(), viaOriginal: z.string().max(160).nullable(), inicio: dataNaoFutura.nullish(), fim: dataNaoFutura.nullish() }).strict()), fim: dataNaoFutura.nullish(), desfecho: z.string().trim().max(500).nullish() }).strict();
export const fatoHistoricoSchema = z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("ASSOCIACAO_PESO_SECAGEM"), dados: associacaoPesoSecagemHistoricaSchema }).strict(),
    z.object({ tipo: z.literal("PESAGEM"), dados: pesagemHistoricaSchema }).strict(),
    z.object({ tipo: z.literal("LEITE"), dados: z.object({ ...fonte, registro: controleHistoricoLeiteSchema }).strict() }).strict(),
    z.object({ tipo: z.literal("ECC"), dados: ecc }).strict(),
    z.object({ tipo: z.literal("QUALIDADE"), dados: qualidade }).strict(),
    z.object({ tipo: z.literal("MASTITE"), dados: mastite }).strict(),
]);
export type FatoHistorico = z.infer<typeof fatoHistoricoSchema>;
export interface OpcoesFatoHistorico {
    operacao: "CRIAR" | "VINCULAR" | "CORRIGIR";
    destinoId?: string;
    motivo?: string;
    versaoEsperada?: number;
    duplicidadesRevisadas?: string[];
}
const contexto = (d: ContextoHistoricoAnimalInput): ContextoHistoricoAnimalInput => ({ animalId: d.animalId, data: d.data, contexto: d.contexto, propriedadeId: d.propriedadeId, evidencia: d.evidencia });
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const uuidFonte = (v: unknown) => { const h = createHash("sha256").update(JSON.stringify(v)).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
function payloadOriginal(texto: string | null): Record<string, unknown> {
    try {
        const payload: unknown = JSON.parse(texto ?? "{}").payload;
        return payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : {};
    } catch { return {}; }
}
function exigirRevisaoDuplicidades(ids: string[], o: OpcoesFatoHistorico) { if (ids.some(id => !o.duplicidadesRevisadas?.includes(id)) || ids.length && (!o.motivo || o.motivo.trim().length < 5))
    throw new RebanhoError("CONFLITO", "Revise os candidatos a duplicidade e declare fatos distintos com motivo, ou vincule um registro existente"); }
function confirmarPesoExistente(p: {
    animalId: string;
    data: Date;
    pesoKg: Prisma.Decimal;
    tipo: string;
    origem: string;
    precisao: string;
    contextoHistorico: string;
    propriedadeId: number | null;
}, d: z.infer<typeof pesagemHistoricaSchema>) { if (p.animalId !== d.animalId || p.data.toISOString().slice(0, 10) !== d.data || !p.pesoKg.eq(d.pesoKg) || p.tipo !== d.tipo || p.origem !== d.origem || p.precisao !== d.precisao || p.contextoHistorico !== d.contexto || p.propriedadeId !== d.propriedadeId)
    throw new RebanhoError("CONFLITO", "Pesagem existente diverge da identidade, data, tipo, origem, precisão, contexto ou quantidade da fonte"); }
export async function prepararFatoHistoricoTx(tx: Prisma.TransactionClient, input: FatoHistorico, autorId: number, opcoes: OpcoesFatoHistorico = { operacao: "CRIAR" }) {
    const fato = fatoHistoricoSchema.parse(input), d = fato.dados;
    if (!Number.isInteger(autorId) || autorId <= 0 || !await tx.usuario.findUnique({ where: { id: autorId }, select: { id: true } }))
        throw new RebanhoError("VALIDACAO", "Importação exige usuário real identificado");
    if (opcoes.operacao === "VINCULAR" && (!opcoes.destinoId || !opcoes.motivo?.trim()))
        throw new RebanhoError("VALIDACAO", "Vínculo exige destino e justificativa explícitos");
    if (fato.tipo === "ASSOCIACAO_PESO_SECAGEM") return prepararAssociacaoPesoSecagemHistoricaTx(tx, fato.dados, autorId, opcoes);
    if (fato.tipo === "LEITE") {
        const p = await prepararControleHistoricoLeiteTx(tx, fato.dados, autorId, opcoes);
        return { entidade: "ControleHistoricoLeite", existenteId: p.existenteId, candidatosDuplicidade: p.candidatosDuplicidade, contexto: { ...p.contexto, resumo: p.resumo } };
    }
    if (opcoes.operacao === "CORRIGIR")
        throw new RebanhoError("CONFLITO", "Este tipo exige correção pelo fluxo auditado do domínio; a carga não reescreve fatos clínicos/pesagens");
    if (fato.tipo === "PESAGEM") {
        if (opcoes.operacao === "VINCULAR") {
            const p = await tx.pesagem.findUnique({ where: { id: opcoes.destinoId } });
            if (!p)
                throw new RebanhoError("NAO_ENCONTRADO", "Pesagem não encontrada");
            confirmarPesoExistente(p, fato.dados);
            await validarContextoHistoricoAnimalTx(tx, contexto(fato.dados));
            return { entidade: "Pesagem", existenteId: p.id, candidatosDuplicidade: [], contexto: p };
        }
        const p = await prepararPesagemHistoricaTx(tx, fato.dados, autorId);
        const candidatos = p.pesagemId ? [] : await tx.pesagem.findMany({ where: { animalId: fato.dados.animalId, data: new Date(fato.dados.data) }, select: { id: true } });
        return { entidade: "Pesagem", existenteId: p.pesagemId, candidatosDuplicidade: candidatos.map(c => c.id), contexto: { ...p, associacaoSecagem: fato.dados.tipo === "SECAGEM" ? "PENDENTE_DE_ENCERRAMENTO_COMPROVADO" : null } };
    }
    if (fato.tipo === "QUALIDADE") {
        if (fato.dados.contexto === "EXTERNO" && fato.dados.sujeito.tipo === "COLETIVO")
            throw new RebanhoError("VALIDACAO", "Qualidade coletiva exige sítio comprovado; não atribua amostra externa à fazenda");
        if (fato.dados.sujeito.tipo === "ANIMAL")
            await validarContextoHistoricoAnimalTx(tx, contexto({ ...fato.dados, animalId: fato.dados.sujeito.animalId }));
        else if (!fato.dados.propriedadeId || !await tx.propriedade.findUnique({ where: { id: fato.dados.propriedadeId }, select: { id: true } }))
            throw new RebanhoError("NAO_ENCONTRADO", "Sítio da amostra não encontrado");
        const formato = await tx.formatoQualidadeLeite.findUnique({ where: { tipoExameId: fato.dados.tipoExameId }, include: { tipoExame: true } });
        if (!formato || !formato.tipoExame.ativo || hashFormatoExame(formato.tipoExame) !== fato.dados.formatoExameHash)
            throw new RebanhoError("CONFLITO", "Formato versionado da qualidade não confere");
        validarObservacoesExame(formato.tipoExame.campos, fato.dados.resultados, fato.dados.resultados.length > 0);
        const externo = fato.dados.contexto === "EXTERNO";
        type Resultado = {
            campo: string;
            valor: Prisma.JsonValue;
            unidade: string | null;
        };
        type Candidato = {
            id: string;
            animalId: string | null;
            origemColetiva: string | null;
            resultados: Resultado[];
        };
        const existentes: Candidato[] = externo
            ? (await tx.exameAnimal.findMany({ where: { animalId: fato.dados.sujeito.tipo === "ANIMAL" ? fato.dados.sujeito.animalId : undefined, data: new Date(fato.dados.data), tipoExameId: fato.dados.tipoExameId, status: "VALIDO" }, include: { resultados: { where: { vigente: true } } } })).map(r => ({ id: r.id, animalId: r.animalId, origemColetiva: null, resultados: r.resultados }))
            : (await tx.amostraQualidadeLeite.findMany({ where: { propriedadeId: fato.dados.propriedadeId!, data: new Date(fato.dados.data), tipoExameId: fato.dados.tipoExameId, status: "VALIDO" }, include: { resultados: { where: { vigente: true } }, exameAnimal: { include: { resultados: { where: { vigente: true } } } } } })).map(r => ({ id: r.id, animalId: r.exameAnimal?.animalId ?? null, origemColetiva: r.origemColetiva, resultados: r.exameAnimal?.resultados ?? r.resultados }));
        let existenteId: string | null = null;
        if (opcoes.operacao === "VINCULAR") {
            const r = existentes.find(r => r.id === opcoes.destinoId);
            if (!r)
                throw new RebanhoError("CONFLITO", "Amostra/exame não corresponde ao formato, sítio e data");
            const animal = fato.dados.sujeito.tipo === "ANIMAL" ? fato.dados.sujeito.animalId : null;
            if (animal && r.animalId !== animal || !animal && r.origemColetiva !== (fato.dados.sujeito.tipo === "COLETIVO" ? fato.dados.sujeito.origem : null))
                throw new RebanhoError("CONFLITO", "Sujeito da qualidade diverge da origem");
            const resultados = r.resultados.map(v => ({ campo: v.campo, valor: v.valor, unidade: v.unidade }));
            const esperados = validarObservacoesExame(formato.tipoExame.campos, fato.dados.resultados, fato.dados.resultados.length > 0);
            if (hashDados(resultados.sort((a, b) => a.campo.localeCompare(b.campo))) !== hashDados(esperados.sort((a, b) => a.campo.localeCompare(b.campo))))
                throw new RebanhoError("CONFLITO", "Resultados da amostra divergem da fonte");
            existenteId = r.id;
        }
        return { entidade: externo ? "ExameAnimal" : "AmostraQualidadeLeite", existenteId, candidatosDuplicidade: existenteId ? [] : existentes.map(r => r.id), contexto: { formato: formato.tipoExame, sujeito: fato.dados.sujeito } };
    }
    const clin = fato.dados;
    await validarContextoHistoricoAnimalTx(tx, contexto(clin));
    if (fato.tipo === "ECC") {
        const tipo = await tx.tipoExame.findUnique({ where: { id: fato.dados.tipoExameId } });
        if (!tipo || !tipo.ativo || tipo.tipoResultado !== "NUMERO" || hashFormatoExame(tipo) !== fato.dados.formatoExameHash)
            throw new RebanhoError("CONFLITO", "ECC exige formato numérico versionado conferido");
        if (fato.dados.resultadoNumero > (fato.dados.escala === "1_A_5" ? 5 : 9))
            throw new RebanhoError("VALIDACAO", "ECC fora da escala comprovada");
        const candidatos = await tx.exameAnimal.findMany({ where: { animalId: fato.dados.animalId, data: new Date(fato.dados.data), tipoExameId: tipo.id, status: "VALIDO" }, include: { resultados: { where: { vigente: true } } } });
        const vinculo = opcoes.operacao === "VINCULAR" ? candidatos.find(c => c.id === opcoes.destinoId) : null;
        if (opcoes.operacao === "VINCULAR") {
            const payload = payloadOriginal(vinculo?.anotacaoOriginal ?? null);
            const resultado = (campo: string) => vinculo?.resultados.find(r => r.campo === campo)?.valor;
            const escala = payload.escala === "1_A_5" ? [1, 5] : payload.escala === "1_A_9" ? [1, 9] : null;
            const valor = resultado("ESCORE") ?? vinculo?.resultadoNumero?.toNumber();
            const minimo = resultado("ESCALA_MIN") ?? payload.escalaMin ?? escala?.[0];
            const maximo = resultado("ESCALA_MAX") ?? payload.escalaMax ?? escala?.[1];
            if (!vinculo || vinculo.propriedadeId !== fato.dados.propriedadeId || !["ECC", "ESCORE_CORPORAL"].includes(vinculo.finalidadePrincipal ?? "") || valor !== fato.dados.resultadoNumero || minimo !== 1 || maximo !== (fato.dados.escala === "1_A_5" ? 5 : 9))
                throw new RebanhoError("CONFLITO", "ECC existente diverge do resultado, escala, finalidade ou sítio da origem");
        }
        return { entidade: "ExameAnimal", existenteId: vinculo?.id ?? null, candidatosDuplicidade: vinculo ? [] : candidatos.map(c => c.id), contexto: { tipo, escala: fato.dados.escala } };
    }
    const doenca = await tx.doenca.findUnique({ where: { id: fato.dados.doencaId } });
    if (!doenca?.ativo)
        throw new RebanhoError("VALIDACAO", "Selecione doença de mastite conferida no catálogo");
    if (fato.dados.fim && fato.dados.fim < fato.dados.data)
        throw new RebanhoError("VALIDACAO", "Fim da ocorrência antecede o início");
    const candidatos = await tx.ocorrenciaSanitaria.findMany({ where: { animalId: fato.dados.animalId, inicio: new Date(fato.dados.data), doencaId: doenca.id, status: "VALIDO" } });
    const existente = opcoes.operacao === "VINCULAR" ? candidatos.find(c => c.id === opcoes.destinoId) : null;
    if (opcoes.operacao === "VINCULAR") {
        const payload = payloadOriginal(existente?.observacao ?? null);
        const achados = payload.achadosPorTeto ?? [];
        const tratamentos = payload.tratamentos ?? [];
        if (!existente || existente.propriedadeId !== fato.dados.propriedadeId || (existente.fim?.toISOString().slice(0, 10) ?? null) !== (fato.dados.fim ?? null) || (existente.desfecho?.trim() || null) !== (fato.dados.desfecho?.trim() || null) || hashDados(achados) !== hashDados(fato.dados.achadosPorTeto) || hashDados(tratamentos) !== hashDados(fato.dados.tratamentos))
            throw new RebanhoError("CONFLITO", "Ocorrência diverge do sítio, encerramento, achados ou tratamentos da origem; revise pelo domínio");
    }
    return { entidade: "OcorrenciaSanitaria", existenteId: existente?.id ?? null, candidatosDuplicidade: existente ? [] : candidatos.map(c => c.id), contexto: { doenca, achados: fato.dados.achadosPorTeto, tratamentos: fato.dados.tratamentos } };
}
export async function gravarFatoHistoricoTx(tx: Prisma.TransactionClient, input: FatoHistorico, autorId: number, opcoes: OpcoesFatoHistorico = { operacao: "CRIAR" }): Promise<{
    id: string;
}> {
    const fato = fatoHistoricoSchema.parse(input), p = await prepararFatoHistoricoTx(tx, fato, autorId, opcoes);
    if (fato.tipo === "ASSOCIACAO_PESO_SECAGEM") return registrarAssociacaoPesoSecagemHistoricaTx(tx, fato.dados, autorId, opcoes);
    if (opcoes.operacao === "VINCULAR") {
        if (!p.existenteId)
            throw new RebanhoError("CONFLITO", "Destino não encontrado");
        await auditar(tx, { entidade: p.entidade, entidadeId: p.existenteId, acao: "VINCULO_IMPORTACAO", usuarioId: autorId, depois: { fonte: fato.dados.bancoOrigem, chave: fato.dados.chaveOrigem, motivo: opcoes.motivo } });
        return { id: p.existenteId };
    }
    if (p.existenteId && opcoes.operacao !== "CORRIGIR")
        return { id: p.existenteId };
    exigirRevisaoDuplicidades(p.candidatosDuplicidade, opcoes);
    if (fato.tipo === "LEITE")
        return registrarControleHistoricoLeiteTx(tx, fato.dados, autorId, opcoes);
    if (fato.tipo === "PESAGEM")
        return registrarPesagemHistoricaTx(tx, fato.dados, autorId);
    if (fato.tipo === "MASTITE") {
        const d = fato.dados;
        const r = await criarOcorrenciaTx(tx, { animalId: d.animalId, propriedadeId: d.propriedadeId ?? 0, doencaId: d.doencaId, inicio: d.data, observacao: JSON.stringify({ payload: d, tratamentoHistoricoSemConsumo: true }) }, autorId, contexto(d));
        if (d.fim)
            await encerrarOcorrenciaTx(tx, r.id, d.propriedadeId, { fim: d.fim, desfecho: d.desfecho ?? null }, autorId);
        return { id: r.id };
    }
    if (fato.tipo === "ECC") {
        const d = fato.dados;
        const origem: OrigemHistoricaExame = { ...contexto(d), bancoOrigem: d.bancoOrigem, chaveOrigem: d.chaveOrigem, snapshotOrigem: d.snapshotOrigem };
        const r = await registrarExameTx(tx, { animalId: d.animalId, propriedadeId: d.propriedadeId ?? 0, data: d.data, tipoExameId: d.tipoExameId, formatoExameHash: d.formatoExameHash, resultadoNumero: d.resultadoNumero, responsavel: d.responsavel }, autorId, false, origem);
        await tx.exameAnimal.update({ where: { id: r.id }, data: { finalidadePrincipal: "ECC", finalidades: ["ECC"], anotacaoOriginal: JSON.stringify({ payload: d }) } });
        return { id: r.id };
    }
    const d = fato.dados;
    if (d.contexto === "EXTERNO" && d.sujeito.tipo === "ANIMAL") {
        const origem: OrigemHistoricaExame = { ...contexto({ ...d, animalId: d.sujeito.animalId }), bancoOrigem: d.bancoOrigem, chaveOrigem: d.chaveOrigem, snapshotOrigem: d.snapshotOrigem };
        const input: ExameInput = { animalId: d.sujeito.animalId, propriedadeId: 0, data: d.data, tipoExameId: d.tipoExameId, formatoExameHash: d.formatoExameHash, resultados: d.resultados, responsavel: d.responsavel };
        const r = await registrarExameTx(tx, input, autorId, true, origem);
        await tx.exameAnimal.update({ where: { id: r.id }, data: { finalidadePrincipal: "QUALIDADE_LEITE", finalidades: ["QUALIDADE_LEITE"], anotacaoOriginal: JSON.stringify({ payload: d }) } });
        return { id: r.id };
    }
    const historico = d.sujeito.tipo === "ANIMAL" ? { ...contexto({ ...d, animalId: d.sujeito.animalId }), bancoOrigem: d.bancoOrigem, chaveOrigem: d.chaveOrigem, snapshotOrigem: d.snapshotOrigem } : undefined;
    const r = await registrarQualidadeTx(tx, { chave: uuidFonte([d.bancoOrigem, d.chaveOrigem]), propriedadeId: d.propriedadeId!, data: d.data, tipoExameId: d.tipoExameId, formatoExameHash: d.formatoExameHash, sujeito: d.sujeito, resultados: d.resultados, responsavel: d.responsavel, anotacaoOriginal: JSON.stringify({ payload: d }), dataResultadoLaboratorial: d.dataResultadoLaboratorial, dataRecebimentoLaudo: d.dataRecebimentoLaudo }, autorId, historico);
    return { id: r.id };
}
