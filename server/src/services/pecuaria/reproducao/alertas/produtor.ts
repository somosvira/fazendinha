import { diaIatf } from "../horarios.calc.js";
import { registrarDecisaoDemandaTx } from "../decisao-demanda.js";
import { convergirNecessidadesTx } from "./identidade.js";
import { filtroInsercoesRetirada } from "../../protocolos/insercoes-retirada.js";
import type { Prisma, NecessidadeReprodutiva } from "@prisma/client";
import { hashConteudo, publicarAlertaTx } from "../../../alertas/publicacao.js";
import { travarAnimais, hojeFazendaDate } from "../../rebanho/regras.js";
import { obterElegibilidadesNaDataTx } from "../elegibilidade.js";
import { situacaoTarefaComum } from "../../protocolos/situacao.js";
import {
  parametrosAtencaoSchema,
  titulosAtencao,
  janelaAtencao,
  somarDias,
  dia,
  type TipoAtencaoReprodutiva,
} from "./contratos.js";
type Tx = Prisma.TransactionClient;
type Candidato = {
  chave: string;
  tipo: TipoAtencaoReprodutiva;
  origemId: string;
  animalId: string;
  propriedadeId: number;
  tarefaId?: string;
  demandaId?: string;
  participacaoId?: string;
  dataReferencia: Date;
  previstaPara: Date | null;
  regraSnapshot: Prisma.InputJsonValue;
  resolvida?: boolean;
  encerrada?: boolean;
  dispensada?: boolean;
  motivo?: string;
};
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v));
const registro = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const terminal = (n: NecessidadeReprodutiva) =>
  ["RESOLVIDO", "ENCERRADO", "DISPENSADO"].includes(n.situacao);

/** Publica só conteúdo operacional; não há custo, observação clínica livre ou execução em GET. */
async function publicarTx(
  tx: Tx,
  n: NecessidadeReprodutiva,
  animal: { brinco: string; nome: string | null },
  usuarioId: number | null,
  hoje: Date,
) {
  const atual = n.alertaId
    ? await tx.alerta.findUnique({ where: { id: n.alertaId } })
    : null;
  const dataOperacional = ["REAGENDAR", "SUSPENDER"].includes(n.decisao ?? "")
    ? (n.revisaoEm ?? n.previstaPara)
    : n.previstaPara;
  const janela = janelaAtencao(dataOperacional, n.regraSnapshot, hoje);
  const encerrado = terminal(n);
  const resumo = {
    necessidadeId: n.id,
    animalId: n.animalId,
    brinco: animal.brinco,
    nome: animal.nome,
    tarefaId: n.tarefaId,
    demandaId: n.demandaId,
    participacaoId: n.participacaoId,
    tipoNecessidade: n.tipo,
    destino: n.decisaoDestino,
    revisaoEm: n.revisaoEm?.toISOString().slice(0, 10) ?? null,
  };
  const conteudo = {
    situacao: n.situacao,
    motivo: n.motivo,
    propriedadeId: n.propriedadeId,
    resumo,
    previstaPara: dataOperacional?.toISOString() ?? null,
    encerrado,
  };
  // Temporal e evento factual podem observar o mesmo estado; não criam revisões vazias.
  if (
    atual &&
    hashConteudo({
      situacao: atual.situacao,
      motivo: atual.motivo,
      propriedadeId: atual.propriedadeId,
      resumo: atual.resumo,
      previstaPara: atual.dataReferencia?.toISOString() ?? null,
      encerrado: atual.ciclo !== "ABERTO",
    }) === hashConteudo(conteudo)
  )
    return;
  const revisao = (atual?.revisao ?? 0) + 1;
  const publicado = await publicarAlertaTx(
    tx,
    {
      proprietario: "fazendinha",
      produtor: "reproducao",
      tipo: n.tipo,
      versaoContrato: 1,
      chaveOcorrencia: n.chave,
      revisaoOrigem: revisao,
      eventoId: `reproducao:${n.id}:${revisao}`,
      comando: atual
        ? encerrado
          ? "ENCERRAR"
          : atual.ciclo !== "ABERTO"
            ? "REABRIR"
            : "PUBLICAR"
        : "PUBLICAR",
      origemId: n.id,
      sujeitoTipo: "ANIMAL",
      sujeitoId: n.animalId,
      propriedadeId: n.propriedadeId,
      chaveAgrupamento: `reproducao:${n.propriedadeId}:${n.tipo}:${n.participacaoId ?? "animais"}`,
      titulo: titulosAtencao[n.tipo as TipoAtencaoReprodutiva],
      motivo: n.motivo,
      situacao: n.situacao,
      resumo,
      dataReferencia: dataOperacional,
      visivelDesde: janela.visivelDesde,
      prazo: n.revisaoEm ?? janela.prazo,
    },
    usuarioId && usuarioId > 0
      ? { usuarioId }
      : { tecnico: "reproducao:reconciliacao" },
  );
  if (!n.alertaId)
    await tx.necessidadeReprodutiva.update({
      where: { id: n.id },
      data: { alertaId: publicado.alertaId },
    });
  // Fontes já resolvidas não devem aparecer abertas nem no primeiro processamento.
  if (!atual && encerrado)
    await publicarAlertaTx(
      tx,
      {
        proprietario: "fazendinha",
        produtor: "reproducao",
        tipo: n.tipo,
        versaoContrato: 1,
        chaveOcorrencia: n.chave,
        revisaoOrigem: 2,
        eventoId: `reproducao:${n.id}:2`,
        comando: "ENCERRAR",
        origemId: n.id,
        sujeitoTipo: "ANIMAL",
        sujeitoId: n.animalId,
        propriedadeId: n.propriedadeId,
        chaveAgrupamento: `reproducao:${n.propriedadeId}:${n.tipo}:${n.participacaoId ?? "animais"}`,
        titulo: titulosAtencao[n.tipo as TipoAtencaoReprodutiva],
        motivo: n.motivo,
        situacao: n.situacao,
        resumo,
        dataReferencia: dataOperacional,
        visivelDesde: janela.visivelDesde,
        prazo: n.revisaoEm ?? janela.prazo,
      },
      usuarioId && usuarioId > 0
        ? { usuarioId }
        : { tecnico: "reproducao:reconciliacao" },
    );
}

/** Fonte única para central/ficha/agenda. O chamador factual compartilha esta transação. */
export async function reconciliarAlertasReprodutivosAnimalTx(
  tx: Tx,
  animalId: string,
  usuarioId: number | null,
  hoje = hojeFazendaDate(),
) {
  await travarAnimais(tx, [animalId]);
  const [animal, local, existentes, participacoes, demandas, exames] =
    await Promise.all([
      tx.animal.findUnique({
        where: { id: animalId },
        select: {
          brinco: true,
          nome: true,
          sexo: true,
          baixas: {
            where: { estornadaEm: null },
            select: { id: true },
            take: 1,
          },
        },
      }),
      tx.localizacaoAnimal.findFirst({
        where: { animalId, ate: null },
        orderBy: { desde: "desc" },
        select: { propriedadeId: true },
      }),
      tx.necessidadeReprodutiva.findMany({ where: { animalId } }),
      tx.participacaoProtocolo.findMany({
        where: { animalId, protocolo: { tipo: "REPRODUTIVO" } },
        include: {
          rodada: true,
          protocolo: { select: { finalidade: true } },
          tarefas: {
            include: {
              etapa: true,
              aplicacoes: true,
              exames: { include: { resultados: { where: { vigente: true } } } },
              tentativas: true,
              manejos: true,
              vinculos: {
                include: {
                  aplicacao: true,
                  exame: {
                    include: { resultados: { where: { vigente: true } } },
                  },
                  tentativa: true,
                  manejo: true,
                },
              },
            },
          },
        },
      }),
      tx.demandaAcompanhamentoReprodutivo.findMany({
        where: { animalId },
        include: {
          decisaoOperacional: true,
          tarefa: { select: { execucaoId: true, dispensadaEm: true } },
        },
      }),
      tx.exameAnimal.findMany({
        where: {
          animalId,
          status: "VALIDO",
          realizacao: "REALIZADO",
          data: { lte: hoje },
        },
        include: { interpretacao: true },
        orderBy: [{ data: "desc" }, { criadoEm: "desc" }, { id: "desc" }],
      }),
    ]);
  if (!animal) return;
  const baixado = animal.baixas.length > 0;
  const candidatos: Candidato[] = [];
  const dispositivos = await tx.aplicacaoProduto.findMany({
    where: filtroInsercoesRetirada(animalId),
    select: {
      id: true,
      data: true,
      propriedadeId: true,
      tarefa: { select: { execucaoId: true } },
    },
  });
  for (const dispositivo of dispositivos) {
    const propriedadeId = local?.propriedadeId ?? dispositivo.propriedadeId;
    if (propriedadeId != null)
      candidatos.push({
        chave: `DISPOSITIVO:${dispositivo.id}`,
        tipo: "DISPOSITIVO_SEM_RETIRADA",
        origemId: dispositivo.id,
        animalId,
        propriedadeId,
        dataReferencia: dispositivo.data,
        previstaPara: null,
        regraSnapshot: json({
          versao: 1,
          origem: "INSERCAO_FISICA",
          resolucao: "RETIRADA_FISICA_VALIDA",
        }),
        motivo: "Sem retirada física registrada para a inserção documentada",
      });
  }

  const tarefasDemandas = new Set(
    demandas.flatMap((d) => (d.tarefaId ? [d.tarefaId] : [])),
  );
  for (const d of demandas) {
    const tipo =
      d.finalidade === "RECONFIRMACAO" ? "RECONFIRMACAO_VENCIDA" : "DG_VENCIDO";
    candidatos.push({
      chave: d.tarefaId ? `TAREFA:${d.tarefaId}` : `DEMANDA:${d.id}`,
      tipo,
      origemId: d.id,
      animalId,
      propriedadeId: local?.propriedadeId ?? d.propriedadeOrigemId,
      tarefaId: d.tarefaId ?? undefined,
      demandaId: d.id,
      participacaoId:
        d.tarefa?.execucaoId ?? d.participacaoAcompanhamentoId ?? undefined,
      dataReferencia: d.dataReferencia,
      previstaPara: d.previstaPara,
      regraSnapshot: json(d.regraSnapshot),
      resolvida: d.estado === "RESOLVIDA",
      encerrada: d.estado === "ENCERRADA",
      dispensada:
        Boolean(d.tarefa?.dispensadaEm) ||
        d.decisaoOperacional?.tipo === "DISPENSAR",
    });
  }
  const politica = local
    ? await tx.politicaAtencaoReprodutiva.findFirst({
        where: {
          propriedadeId: local.propriedadeId,
          vigenteDesde: { lte: hoje },
        },
        orderBy: { vigenteDesde: "desc" },
      })
    : null;
  const parametros = politica
    ? parametrosAtencaoSchema.parse(politica.parametros)
    : null;
  const prazoOperacional = (tipo: TipoAtencaoReprodutiva, referencia: Date) => {
    const regra = parametros?.regras.find((r) => r.tipo === tipo);
    return {
      previstaPara: regra ? somarDias(referencia, regra.intervalo) : null,
      regraSnapshot: json(
        regra
          ? {
              ...regra,
              politicaId: politica!.id,
              politicaVersao: politica!.versao,
            }
          : { versao: 1, origem: "SEM_REGRA", tipo },
      ),
    };
  };
  for (const p of participacoes) {
    if (p.propriedadeId == null) continue;
    const encerrada = Boolean(
      p.canceladaEm || (p.rodada && p.rodada.status !== "ABERTA"),
    );
    for (const t of p.tarefas) {
      if (tarefasDemandas.has(t.id)) continue;
      const estado = situacaoTarefaComum({ ...t, execucao: p });
      const configuracao = registro(t.etapa.configuracao),
        planejado = registro(t.parametros);
      const plano = registro(
        configuracao.planoAvaliacao ?? registro(planejado.etapa).planoAvaliacao,
      );
      const pedeDG = ["DIAGNOSTICO", "RECONFIRMACAO"].includes(
        String(plano.tipo),
      );
      const examesTarefa = [
        ...t.exames,
        ...t.vinculos
          .filter((v) => v.estado === "ATUAL")
          .flatMap((v) => (v.exame ? [v.exame] : [])),
      ];
      const conclusaoDG = examesTarefa.some(
        (e) =>
          e.status === "VALIDO" &&
          e.realizacao === "REALIZADO" &&
          e.resultados.some(
            (r) =>
              r.campo === "CONCLUSAO_GESTACIONAL" &&
              ["POSITIVO", "NEGATIVO"].includes(String(r.valor)),
          ),
      );
      const residualDG = pedeDG && estado === "REALIZADA" && !conclusaoDG;

      candidatos.push({
        chave: `TAREFA:${t.id}`,
        tipo: pedeDG
          ? plano.tipo === "RECONFIRMACAO"
            ? "RECONFIRMACAO_VENCIDA"
            : "DG_VENCIDO"
          : t.previsaoPendente
            ? "AGENDAMENTO_INCOMPLETO"
            : "ETAPA_VENCIDA",
        origemId: t.id,
        animalId,
        propriedadeId: local?.propriedadeId ?? p.propriedadeId,
        tarefaId: t.id,
        participacaoId: p.id,
        dataReferencia: p.inicio,
        previstaPara: residualDG || t.previsaoPendente ? null : t.previstaPara,
        regraSnapshot: json({
          versao: 1,
          origem: "AGENDAMENTO_INDIVIDUAL",
          antecedencia: 0,
          tolerancia: 0,
        }),
        resolvida: estado === "REALIZADA" && !residualDG,
        encerrada: encerrada || estado === "ENCERRADA_SEM_SUBSTITUICAO",
        dispensada: Boolean(t.dispensadaEm),
      });
    }
    const preparo = p.tarefas.filter(
      (t) =>
        !["TENTATIVA", "IA", "TE", "EXAME", "AVALIACAO"].includes(t.etapa.tipo),
    );
    const concluiu =
      preparo.length > 0 &&
      preparo.every(
        (t) => situacaoTarefaComum({ ...t, execucao: p }) === "REALIZADA",
      );
    // A tentativa incluída como tarefa já é a necessidade canônica; não duplica um alerta de preparo.
    if (
      concluiu &&
      ["IATF", "TETF"].includes(p.protocolo.finalidade ?? "") &&
      !p.tarefas.some((t) => ["TENTATIVA", "IA", "TE"].includes(t.etapa.tipo))
    ) {
      // Tentativa.data e os intervalos em DIAS têm precisão civil. Uma hora
      // conhecida do preparo não pode excluir a tentativa do mesmo dia.
      const diasPreparo = preparo.map((t) => diaIatf(
        t.realizadaEm ?? t.previstaPara,
        t.realizadaEm ? (t.precisaoRealizacao ?? "HORA") : t.precisaoTemporal,
      ));
      const referencia = dia(diasPreparo.reduce((ultimo, atual) => atual > ultimo ? atual : ultimo));
      const tentativa = await tx.tentativaReprodutiva.findFirst({
        where: {
          animalId,
          status: "VALIDO",
          data: { gte: referencia },
          OR: [
            { tarefa: { execucaoId: p.id } },
            {
              participacoesExplicitas: {
                some: { participacaoId: p.id, revogadoEm: null },
              },
            },
          ],
        },
        select: { id: true },
      });
      candidatos.push({
        chave: `PREPARO:${p.id}`,
        tipo: "TENTATIVA_APOS_PREPARO",
        origemId: p.id,
        animalId,
        propriedadeId: local?.propriedadeId ?? p.propriedadeId,
        participacaoId: p.id,
        dataReferencia: referencia,
        ...prazoOperacional("TENTATIVA_APOS_PREPARO", referencia),
        resolvida: Boolean(tentativa),
        encerrada,
      });
    }
  }
  if (local && animal.sexo === "F") {
    const elegibilidade = (
      await obterElegibilidadesNaDataTx(
        tx,
        [animalId],
        local.propriedadeId,
        hoje,
      )
    ).get(animalId);
    const aptidao = elegibilidade?.aptidao;
    const ultimo = exames.find(
      (e) =>
        e.interpretacao?.resultadoAptidao != null ||
        e.finalidades.includes("APTIDAO_REPRODUTIVA") ||
        e.finalidadePrincipal === "AVALIACAO_REPRODUTIVA",
    );
    const encaminhamento =
      participacoes.some(
        (p) =>
          !p.canceladaEm &&
          (!p.rodada || p.rodada.status === "ABERTA") &&
          (!aptidao?.data || p.inicio >= new Date(aptidao.data)),
      ) ||
      exames.some(
        (e) =>
          e.interpretacao &&
          (!aptidao?.data || e.data >= new Date(aptidao.data)) &&
          Array.isArray(registro(e.interpretacao).condutasContextuais) &&
          (registro(e.interpretacao).condutasContextuais as unknown[]).some(
            (c) =>
              ["INDICAR_TENTATIVA", "INDICAR_PROTOCOLO"].includes(
                String(registro(c).tipo),
              ),
          ),
      );
    if (aptidao?.estado === "APTA" && aptidao.exameId && aptidao.data) {
      const referencia = new Date(aptidao.data);
      candidatos.push({
        chave: `APTA:${aptidao.exameId}`,
        tipo: "APTA_SEM_ENCAMINHAMENTO",
        origemId: aptidao.exameId,
        animalId,
        propriedadeId: local.propriedadeId,
        dataReferencia: referencia,
        ...prazoOperacional("APTA_SEM_ENCAMINHAMENTO", referencia),
        resolvida: encaminhamento,
      });
    }
    if (ultimo) {
      candidatos.push({
        chave: `AVALIACAO:${ultimo.id}`,
        tipo: "AVALIACAO_DESATUALIZADA",
        origemId: ultimo.id,
        animalId,
        propriedadeId: local.propriedadeId,
        dataReferencia: ultimo.data,
        ...prazoOperacional("AVALIACAO_DESATUALIZADA", ultimo.data),
      });
    } else if (aptidao?.estado === "PENDENTE") {
      const ciclo = await tx.vinculoPoliticaCiclo.findFirst({
        where: { animalId, inicioCiclo: { lte: hoje } },
        orderBy: { inicioCiclo: "desc" },
      });
      if (ciclo)
        candidatos.push({
          chave: `AVALIACAO_CICLO:${ciclo.id}`,
          tipo: "AVALIACAO_NECESSARIA",
          origemId: ciclo.id,
          animalId,
          propriedadeId: local.propriedadeId,
          dataReferencia: ciclo.inicioCiclo,
          ...prazoOperacional("AVALIACAO_NECESSARIA", ciclo.inicioCiclo),
        });
    }
    // Retorno explícito é compromisso do exame, sem prazo clínico inventado.
    for (const e of exames) {
      const i = e.interpretacao;
      if (!i) continue;
      const condutas = registro(i).condutasContextuais;
      const retornoContextual = Array.isArray(condutas)
        ? condutas
            .filter((c) => registro(c).tipo === "RETORNO")
            .map((c) => registro(c).retornoEm)
            .find((d): d is string => typeof d === "string")
        : null;
      const retorno =
        i.retornoAptidaoEm ??
        i.retornoEm ??
        (retornoContextual ? new Date(retornoContextual) : null);
      if (!retorno) continue;
      const posterior = exames.some(
        (x) =>
          x.id !== e.id &&
          x.data >= retorno &&
          x.data > e.data &&
          x.interpretacao &&
          x.finalidades.some((f) => e.finalidades.includes(f)),
      );
      candidatos.push({
        chave: `RETORNO:${e.id}`,
        tipo: "RETORNO_VENCIDO",
        origemId: e.id,
        animalId,
        propriedadeId: local.propriedadeId,
        dataReferencia: e.data,
        previstaPara: retorno,
        regraSnapshot: json({
          versao: 1,
          origem: "CONDUTA_EXPLICITA",
          antecedencia: 0,
          tolerancia: 0,
        }),
        resolvida: posterior,
      });
    }
  }
  for (const c of candidatos) {
    // O calendário de atenção opera em dias civis; a tarefa conserva sua hora original.
    c.dataReferencia = dia(c.dataReferencia.toISOString().slice(0, 10));
    if (c.previstaPara)
      c.previstaPara = dia(c.previstaPara.toISOString().slice(0, 10));
    if (baixado) c.encerrada = true;
    let anterior =
      existentes.find(
        (n) =>
          !n.convergidaParaId && c.demandaId && n.demandaId === c.demandaId,
      ) ??
      existentes.find(
        (n) => !n.convergidaParaId && c.tarefaId && n.tarefaId === c.tarefaId,
      ) ??
      existentes.find((n) => !n.convergidaParaId && n.chave === c.chave);
    let decisaoReunida: NecessidadeReprodutiva | null = null;
    const outra = existentes.find(
      (n) =>
        !n.convergidaParaId &&
        n.id !== anterior?.id &&
        c.tarefaId &&
        n.tarefaId === c.tarefaId,
    );
    if (anterior && outra) {
      const reunidas = await convergirNecessidadesTx(
        tx,
        anterior,
        outra,
        usuarioId,
      );
      if (
        reunidas.destino.decisao !== anterior.decisao ||
        reunidas.destino.decisaoPorId !== anterior.decisaoPorId ||
        reunidas.destino.revisaoEm?.getTime() !== anterior.revisaoEm?.getTime()
      )
        decisaoReunida = reunidas.destino;
      anterior = reunidas.destino;
      existentes[existentes.findIndex((n) => n.id === outra.id)] =
        reunidas.origem;
      await publicarTx(tx, reunidas.origem, animal, usuarioId, hoje);
    }
    // Prazos operacionais congelados seguem a regra da primeira adoção. Tarefa/demanda têm revisão própria explícita.
    const congelar = !c.tarefaId && !c.demandaId ? anterior : undefined;
    const previstaPara = congelar ? congelar.previstaPara : c.previstaPara,
      regraSnapshot = congelar ? json(congelar.regraSnapshot) : c.regraSnapshot;
    let situacao = c.resolvida
      ? "RESOLVIDO"
      : c.dispensada
        ? "DISPENSADO"
        : c.encerrada
          ? "ENCERRADO"
          : janelaAtencao(
              anterior &&
                ["REAGENDAR", "SUSPENDER"].includes(anterior.decisao ?? "")
                ? (anterior.revisaoEm ?? previstaPara)
                : previstaPara,
              regraSnapshot,
              hoje,
            ).situacao;
    if (!c.resolvida && anterior?.decisao === "DISPENSAR")
      situacao = "DISPENSADO";
    if (
      !c.resolvida &&
      !c.encerrada &&
      anterior?.revisaoEm &&
      anterior.revisaoEm > hoje &&
      ["SUSPENDER", "REAGENDAR"].includes(anterior.decisao ?? "")
    )
      situacao = anterior.decisao === "SUSPENDER" ? "SUSPENSO" : "ADIADO";
    const motivo =
      c.tipo === "DISPOSITIVO_SEM_RETIRADA"
        ? "Sem retirada física registrada para a inserção documentada"
        : situacao === "PLANEJAMENTO_PENDENTE"
          ? "Planejamento pendente: prazo ou regra não definido"
          : situacao === "RESOLVIDO"
            ? "Atendimento factual válido registrado"
            : situacao === "ENCERRADO"
              ? "Origem encerrada ou decisão terminal"
              : situacao === "DISPENSADO"
                ? (anterior?.decisaoMotivo ?? "Cuidado dispensado")
                : situacao === "SUSPENSO" || situacao === "ADIADO"
                  ? (anterior?.decisaoMotivo ?? "Revisão agendada")
                  : "Sem atendimento registrado";
    if (!anterior && (c.resolvida || c.encerrada)) continue;
    const dados = {
      tipo: anterior?.tipo ?? c.tipo,
      origemId: c.origemId,
      animalId,
      propriedadeId: c.propriedadeId,
      tarefaId: c.tarefaId ?? null,
      demandaId: c.demandaId ?? null,
      participacaoId: c.participacaoId ?? null,
      dataReferencia: c.dataReferencia,
      previstaPara,
      regraSnapshot,
      situacao,
      motivo,
    };
    const mudou =
      !anterior ||
      hashConteudo({ ...dados, regraSnapshot }) !==
        hashConteudo(
          Object.fromEntries(
            Object.keys(dados).map((k) => [k, registro(anterior)[k]]),
          ),
        );
    const salva = anterior
      ? mudou
        ? await tx.necessidadeReprodutiva.update({
            where: { id: anterior.id },
            data: { ...dados, revisao: { increment: 1 } },
          })
        : anterior
      : await tx.necessidadeReprodutiva.create({
          data: { ...dados, chave: c.chave },
        });
    if (
      decisaoReunida &&
      outra &&
      c.demandaId &&
      !c.resolvida &&
      !c.encerrada &&
      decisaoReunida.decisaoPorId &&
      decisaoReunida.decisaoMotivo &&
      ["REAGENDAR", "SUSPENDER", "DISPENSAR"].includes(
        decisaoReunida.decisao ?? "",
      )
    ) {
      await registrarDecisaoDemandaTx(tx, {
        demandaId: c.demandaId,
        necessidadeId: salva.id,
        chave: `CONVERGENCIA:${outra.id}`,
        tipo: decisaoReunida.decisao ?? "",
        data: decisaoReunida.revisaoEm,
        destino: decisaoReunida.decisaoDestino,
        motivo: decisaoReunida.decisaoMotivo,
        usuarioId: decisaoReunida.decisaoPorId,
      });
    }
    await publicarTx(tx, salva, animal, usuarioId, hoje);
  }
  const chaves = new Set(candidatos.map((c) => c.chave));
  const demandasAtuais = new Set(
    candidatos.flatMap((c) => (c.demandaId ? [c.demandaId] : [])),
  );
  const tarefasAtuais = new Set(
    candidatos.flatMap((c) => (c.tarefaId ? [c.tarefaId] : [])),
  );
  for (const n of existentes) {
    if (
      n.convergidaParaId ||
      chaves.has(n.chave) ||
      (n.demandaId && demandasAtuais.has(n.demandaId)) ||
      (n.tarefaId && tarefasAtuais.has(n.tarefaId)) ||
      terminal(n)
    )
      continue;
    const retirada =
      n.tipo === "DISPOSITIVO_SEM_RETIRADA"
        ? await tx.manejoAnimal.findFirst({
            where: {
              insercaoAplicacaoId: n.origemId,
              OR: [{ status: "VALIDO" }, { realizacaoMantida: true }],
            },
            select: { id: true },
          })
        : null;
    const salva = await tx.necessidadeReprodutiva.update({
      where: { id: n.id },
      data: {
        situacao: retirada ? "RESOLVIDO" : "ENCERRADO",
        motivo: retirada
          ? "Retirada física válida registrada"
          : "Contexto de origem substituído ou inválido",
        revisao: { increment: 1 },
      },
    });
    await publicarTx(tx, salva, animal, usuarioId, hoje);
  }
}
