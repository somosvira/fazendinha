import { tentarTravarAnimaisAlertasTx, tentarTravarConfiguracaoAlertaTx } from "../alertas/concorrencia.js";
import type { Prisma } from "@prisma/client";
import { hashConteudo, publicarAlertaTx } from "../../../alertas/publicacao.js";
import type { AutorAlerta } from "../../../alertas/contratos.js";
import { RebanhoError } from "../../rebanho/regras.js";
import { pendenciasAtivacao } from "./consulta.js";
import { elegivelProgramacao, janelaPublicavel } from "./elegibilidade.calc.js";
import { chaveNecessidadeProgramacao } from "./calendario.calc.js";
/** Cursor por ID, até 50 animais. Chamador confirma checkpoint junto da transação. */
export async function avaliarProgramacaoTx(tx: Prisma.TransactionClient, id: string, hoje: Date, autor: AutorAlerta, cursorAnimalId?: string) {
  await tentarTravarConfiguracaoAlertaTx(tx, "programacao", id);
  const p = await tx.programacaoSanitaria.findUnique({ where: { id } });
  if (!p || !p.ativo) return { publicados: 0, cursorAnimalId: null, concluido: true };
  if (pendenciasAtivacao(p).length) throw new RebanhoError("VALIDACAO", "Programação exige conferência de executor ou equivalência");
  const regraEquivalente = p.regraEquivalenteId ? await tx.regraAlertaSanitario.findUnique({ where: { id: p.regraEquivalenteId } }) : null;
  if (p.regraEquivalenteId && (!regraEquivalente?.ativo || !regraEquivalente.propriedadeIds.includes(p.propriedadeId) || regraEquivalente.produtoId !== p.produtoId || p.recorrencia === "CAMPANHA_ANUAL")) return { publicados: 0, cursorAnimalId: null, concluido: true };
  const janelas = janelaPublicavel(p, hoje);
  if (!janelas.length) return { publicados: 0, cursorAnimalId: null, concluido: true };
  const consultaAnimais = { where: { ...(cursorAnimalId ? { id: { gt: cursorAnimalId } } : {}),
    localizacoes: { some: { propriedadeId: p.propriedadeId, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] } },
    baixas: { none: { estornadaEm: null, data: { lte: hoje } } } }, orderBy: { id: "asc" }, take: 50,
    select: { id: true, sexo: true, dataNascimento: true, nascimentoEstimado: true, brinco: true, nome: true, localizacoes: { where: { propriedadeId: p.propriedadeId, desde: { lte: hoje }, OR: [{ ate: null }, { ate: { gt: hoje } }] }, select: { loteId: true }, take: 1 } } } as const;
  const candidatos = await tx.animal.findMany(consultaAnimais);
  await tentarTravarAnimaisAlertasTx(tx, candidatos.map(a => a.id));
  // Releitura em ReadCommitted: seleção anterior serve somente ao cursor e às travas.
  const animais = candidatos.length ? await tx.animal.findMany({ ...consultaAnimais, where: { ...consultaAnimais.where, id: { in: candidatos.map(a => a.id) } } }) : [];
  let publicados = 0;
  const produto = p.produtoId ? await tx.produto.findUnique({ where: { id: p.produtoId }, select: { nome: true, ativo: true, usoSanitario: true } }) : null;
  if (p.produtoId && (!produto?.ativo || !produto.usoSanitario)) return { publicados: 0, cursorAnimalId: null, concluido: true };
  if (p.executor === "EXAME_ANIMAL") {
    const exame = p.tipoExameId ? await tx.tipoExame.findUnique({ where: { id: p.tipoExameId }, select: { ativo: true, contexto: true } }) : null;
    if (!exame?.ativo || exame.contexto === "REPRODUTIVO") return { publicados: 0, cursorAnimalId: null, concluido: true };
  }
  for (const animal of animais) {
    if (!elegivelProgramacao(p.publico, animal, hoje)) continue;
    for (const janela of janelas) {
      const identidade = { programacaoId: p.id, periodo: janela.periodo, sujeitoTipo: "ANIMAL", sujeitoId: animal.id };
      // Lock da identidade anterior à inserção protege campanha/elegibilidade e replay do lote.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(identidade)}, 0))`;
      if (await tx.necessidadeProgramacaoSanitaria.findUnique({ where: { programacaoId_periodo_sujeitoTipo_sujeitoId: identidade } })) continue;
      if (p.regraEquivalenteId) {
        const existente = await tx.necessidadeSanitaria.findUnique({ where: { regraId_animalId: { regraId: p.regraEquivalenteId, animalId: animal.id } } });
        if (!existente?.alertaId) continue;
        if (existente.propriedadeId !== p.propriedadeId) continue;
        await tx.necessidadeProgramacaoSanitaria.create({ data: { ...identidade, propriedadeId: p.propriedadeId, situacao: existente.situacao, regraNecessidadeId: existente.id, alertaId: existente.alertaId } });
        continue;
      }
      const n = await tx.necessidadeProgramacaoSanitaria.create({ data: { ...identidade, propriedadeId: p.propriedadeId, situacao: janela.situacao } });
      const chave = chaveNecessidadeProgramacao(p.id, janela.periodo, "ANIMAL", animal.id);
      const resultado = await publicarAlertaTx(tx, { proprietario: "fazendinha", produtor: "sanidade", tipo: "PROGRAMACAO", versaoContrato: 1,
        chaveOcorrencia: chave, revisaoOrigem: 1, eventoId: `programacao:${n.id}:1`, comando: "PUBLICAR", origemId: n.id,
        sujeitoTipo: "ANIMAL", sujeitoId: animal.id, propriedadeId: p.propriedadeId, chaveAgrupamento: JSON.stringify([p.id, janela.periodo, p.propriedadeId]),
        titulo: p.nome, motivo: janela.precisao === "MES" ? "Programação mensal — dia a definir" : "Programação com dia definido", situacao: janela.situacao,
        resumo: { programacaoSnapshot: JSON.parse(JSON.stringify(p)), necessidadeId: n.id, programacaoId: p.id, animalId: animal.id, brinco: animal.brinco, nome: animal.nome, loteId: animal.localizacoes[0]?.loteId ?? null,
          produtoId: p.produtoId, produtoNome: produto?.nome ?? null, periodo: janela.periodo, precisao: janela.precisao, inicioJanela: janela.inicioJanela, fimJanela: janela.fimJanela, nascimentoEstimado: animal.nascimentoEstimado },
        dataReferencia: janela.precisao === "DIA" ? new Date(`${janela.inicioJanela}T00:00:00Z`) : null, visivelDesde: janela.visivelDesde, prazo: null }, autor);
      await tx.necessidadeProgramacaoSanitaria.update({ where: { id: n.id }, data: { alertaId: resultado.alertaId } }); publicados++;
    }
  }
  return { publicados, cursorAnimalId: candidatos.at(-1)?.id ?? null, concluido: candidatos.length < 50 };
}
export { hashConteudo };
