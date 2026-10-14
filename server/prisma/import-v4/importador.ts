import { registrarEvidenciaAvaliacaoTx } from "../../src/services/pecuaria/exames/evidencia-reprodutiva.js";
import { createHash } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type { CargaV4, FatoV4, MapeamentoV4 } from "./contrato.js";

type Tx = Prisma.TransactionClient;
type Item = {
  chave: string;
  hash: string;
  entidade: string;
  gravacao: (tx: Tx) => Promise<string>;
};
export interface RelatorioV4 {
  modo: "PREVIA" | "EXECUCAO";
  planejados: number;
  importados: number;
  existentes: number;
  conflitos: { chave: string; motivo: string }[];
  lacunas: CargaV4["relatorio"]["pendencias"];
  totaisFonte: CargaV4["relatorio"]["totais"];
}
const data = (v: string) => new Date(v + "T00:00:00Z");
const hash = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
const json = (v: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const num = (v: string | null | undefined) =>
  v && /^\d+$/.test(v) ? Number(v) : null;
const referencia = (banco: string, chave: string) => `${banco}:${chave}`;

/** Carga inicial/reconciliação técnica. Nunca atualiza fatos existentes ou movimenta estoque.
 * Prévia usa somente leitura; execução exige servidor local e mapa/autor explícitos no CLI.
 * Uma unidade importável e seus vínculos/auditoria são gravados atomicamente. */
export async function importarV4(
  db: PrismaClient,
  carga: CargaV4,
  mapa: MapeamentoV4,
  executar = false,
): Promise<RelatorioV4> {
  const relatorio: RelatorioV4 = {
    modo: executar ? "EXECUCAO" : "PREVIA",
    planejados: 0,
    importados: 0,
    existentes: 0,
    conflitos: [],
    lacunas: carga.relatorio.pendencias,
    totaisFonte: carga.relatorio.totais,
  };
  const autor = await db.usuario.findUnique({ where: { id: mapa.autorId } });
  if (!autor)
    throw new Error("Autor explícito não existe no banco de destino.");
  const animais = await db.animal.findMany({
    where: { ideagriId: { in: carga.animais.flatMap((a) => num(a.id) ?? []) } },
    include: { localizacoes: true },
  });
  const animalPorIdeagri = new Map(animais.map((a) => [a.ideagriId!, a]));
  const vinculos = await db.vinculoImportacaoPecuaria.findMany({
    where: { bancoOrigem: mapa.bancoOrigem },
  });
  const vinculoPorChave = new Map(
    vinculos.map((v) => [`${v.tabelaOrigem}:${v.chaveOrigem}`, v]),
  );
  const [
    tentativasAtuais,
    partosAtuais,
    avaliacoesAtuais,
    lactacoesAtuais,
    criasAtuais,
    situacoesAtuais,
    restricoesAtuais,
  ] = await Promise.all([
    db.tentativaReprodutiva.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.partoAnimal.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.avaliacaoReprodutiva.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.lactacaoAnimal.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.criaParto.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.situacaoInicialReprodutiva.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
    db.restricaoReprodutiva.findMany({
      where: { animalId: { in: animais.map((a) => a.id) } },
    }),
  ]);
  const animaisOperacionais = new Set(
    [
      ...tentativasAtuais,
      ...partosAtuais,
      ...avaliacoesAtuais,
      ...lactacoesAtuais,
      ...situacoesAtuais,
      ...restricoesAtuais,
    ]
      .filter((f) => f.origem !== "IDEAGRI")
      .map((f) => f.animalId),
  );
  const planos: Item[] = [];
  const destinos = new Map(
    vinculos.map((v) => [`${v.tabelaOrigem}:${v.chaveOrigem}`, v.destinoId]),
  );
  const bloquear = (chave: string, motivo: string) =>
    relatorio.conflitos.push({ chave, motivo });
  const local = (animal: (typeof animais)[number], dia: string) => {
    const quando = data(dia);
    const locais = animal.localizacoes.filter(
      (l) => l.desde <= quando && (!l.ate || l.ate > quando),
    );
    return locais.length === 1 ? locais[0].propriedadeId : null;
  };
  const adicionar = (
    chave: string,
    fonte: unknown,
    entidade: string,
    gravacao: Item["gravacao"],
  ) => {
    const h = hash(fonte);
    const existente = vinculoPorChave.get(chave);
    if (existente) {
      if (existente.hashOrigem !== h)
        bloquear(
          chave,
          "Origem/mapeamento diverge da carga anterior; revisão explícita exigida.",
        );
      else relatorio.existentes++;
      return;
    }
    planos.push({ chave, hash: h, entidade, gravacao });
  };
  const auditoria = async (
    tx: Tx,
    entidade: string,
    id: string,
    animalId: string | null,
    depois: unknown,
    propriedadeId: number | null = null,
  ) => {
    await tx.auditoriaPecuaria.create({
      data: {
        entidade,
        entidadeId: id,
        animalId,
        propriedadeId,
        acao: "IMPORTACAO",
        usuarioId: mapa.autorId,
        depois: json(depois),
      },
    });
  };
  const base = (f: FatoV4, a: (typeof animais)[number]) => ({
    referenciaExterna: referencia(mapa.bancoOrigem, f.chaveExterna),
    animalId: a.id,
    propriedadeId: local(a, f.data),
    data: data(f.data),
    origem: "IDEAGRI",
    criadoPorId: mapa.autorId,
  });
  const ordensPorCiclo = new Map<string, number>();
  for (const f of [...carga.fatos].sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      Number(a.snapshot.id) - Number(b.snapshot.id),
  )) {
    const a = animalPorIdeagri.get(f.animalIdeagriId);
    if (!a) {
      bloquear(
        f.chaveExterna,
        "Animal IDEAGRI não encontrado; importe/confira identidade V1 antes.",
      );
      continue;
    }
    if (animaisOperacionais.has(a.id)) {
      bloquear(
        f.chaveExterna,
        "Animal já possui fatos operacionais; reconciliar manualmente sem alterar seu ciclo.",
      );
      continue;
    }
    if (a.sexo !== "F") {
      bloquear(f.chaveExterna, "Fato reprodutivo exige fêmea.");
      continue;
    }
    if (!f.tipo) {
      bloquear(f.chaveExterna, "Tipo não suportado.");
      continue;
    }
    if (
      f.tipo === "PARTO" &&
      (f.anteriorEntrada || data(f.data) < a.dataEntrada) &&
      mapa.saldoAnteriorPorParto[f.chaveExterna] === undefined
    ) {
      bloquear(
        f.chaveExterna,
        "Parto anterior à entrada: decidir explicitamente se incluído no saldo anterior.",
      );
      continue;
    }
    if (
      ["IA", "TE", "COBERTURA"].includes(f.tipo) &&
      data(f.data) < a.dataEntrada &&
      mapa.cicloPorTentativa[f.chaveExterna] === undefined
    ) {
      bloquear(
        f.chaveExterna,
        "Tentativa anterior à entrada: ciclo histórico exige mapeamento explícito.",
      );
      continue;
    }
    const ciclo =
      mapa.cicloPorTentativa[f.chaveExterna] ??
      a.partosAntesDaEntrada +
        carga.fatos.filter(
          (p) =>
            p.tipo === "PARTO" &&
            p.animalIdeagriId === f.animalIdeagriId &&
            p.data <= f.data &&
            !mapa.saldoAnteriorPorParto[p.chaveExterna],
        ).length;
    const chaveCiclo = `${a.id}:${ciclo}`;
    const ordem = (ordensPorCiclo.get(chaveCiclo) ?? 0) + 1;
    if (["IA", "TE", "COBERTURA"].includes(f.tipo))
      ordensPorCiclo.set(chaveCiclo, ordem);
    if (
      ["IA", "TE", "COBERTURA"].includes(f.tipo) &&
      tentativasAtuais.some(
        (t) =>
          t.animalId === a.id &&
          t.ciclo === ciclo &&
          t.ordem === ordem &&
          t.referenciaExterna !== referencia(mapa.bancoOrigem, f.chaveExterna),
      )
    ) {
      bloquear(
        f.chaveExterna,
        "Ordem/ciclo ocupados por outra tentativa; não sobrescrever.",
      );
      continue;
    }
    const ref = referencia(mapa.bancoOrigem, f.chaveExterna);
    if (
      [...tentativasAtuais, ...partosAtuais, ...avaliacoesAtuais].some(
        (t) => t.referenciaExterna === ref,
      ) &&
      !vinculoPorChave.has(f.chaveExterna)
    ) {
      bloquear(
        f.chaveExterna,
        "Referência existente sem vínculo auditado de importação.",
      );
      continue;
    }
    const incluidoSaldoAnterior =
      mapa.saldoAnteriorPorParto[f.chaveExterna] ?? false;
    const crias =
      mapa.criasPorParto[f.chaveExterna] ??
      f.criasComReferencia.map((id, i) => ({
        animalIdeagriId: id,
        ordem: i + 1,
      }));
    if (
      f.tipo === "PARTO" &&
      crias.some((c) => !animalPorIdeagri.has(c.animalIdeagriId))
    ) {
      bloquear(
        f.chaveExterna,
        "Cria explicitamente referenciada não existe; não criar animal por inferência.",
      );
      continue;
    }
    if (f.tipo === "PARTO") {
      const original = carga.animais.find(
        (x) => num(x.id) === f.animalIdeagriId,
      );
      if (
        original?.partosAntesEntrada != null &&
        num(original?.partosAntesEntrada) !== a.partosAntesDaEntrada
      ) {
        bloquear(
          f.chaveExterna,
          "Saldo anterior IDEAGRI diverge do saldo preservado no animal; decidir reconciliação.",
        );
        continue;
      }
      if (
        crias.length &&
        ["ABORTO", "NATIMORTO", "MISTO"].includes(f.desfecho ?? "")
      ) {
        bloquear(
          f.chaveExterna,
          "Desfecho misto/não vivo exige decisão individual das crias.",
        );
        continue;
      }
      if (
        crias.some(
          (c) =>
            animalPorIdeagri
              .get(c.animalIdeagriId)!
              .dataNascimento.toISOString()
              .slice(0, 10) !== f.data ||
            (criasAtuais.some(
              (x) => x.animalId === animalPorIdeagri.get(c.animalIdeagriId)!.id,
            ) &&
              !vinculoPorChave.has(f.chaveExterna)),
        )
      ) {
        bloquear(
          f.chaveExterna,
          "Cria possui nascimento incompatível ou vínculo em outro parto.",
        );
        continue;
      }
      if (
        new Set(crias.map((c) => c.ordem)).size !== crias.length ||
        new Set(crias.map((c) => c.animalIdeagriId)).size !== crias.length
      ) {
        bloquear(f.chaveExterna, "Cria/ordem duplicada no mapeamento.");
        continue;
      }
    }
    adicionar(
      f.chaveExterna,
      { f, incluidoSaldoAnterior, crias, ciclo, ordem },
      f.tipo === "PARTO"
        ? "PartoAnimal"
        : f.tipo === "DIAGNOSTICO"
          ? "AvaliacaoReprodutiva"
          : "TentativaReprodutiva",
      async (tx) => {
        const b = base(f, a);
        let id: string;
        if (f.tipo === "PARTO") {
          const parto = await tx.partoAnimal.create({
            data: {
              ...b,
              tipo:
                f.desfecho === "ABORTO"
                  ? "ABORTO"
                  : f.desfecho === "NATIMORTO"
                    ? "NATIMORTO"
                    : f.desfechoOriginal === "Auxiliado"
                      ? "DISTOCICO"
                      : "NORMAL",
              incluidoSaldoAnterior,
              observacao: JSON.stringify({
                original: f.snapshot,
                desfecho: f.desfecho,
                criasSemReferencia: !crias.length,
              }),
            },
          });
          id = parto.id;
          if (
            crias.length &&
            ["ABORTO", "NATIMORTO", "MISTO"].includes(f.desfecho ?? "")
          )
            throw new Error(
              "Desfecho misto/não vivo exige reconciliação individual; não assumir cria viva.",
            );
          for (const c of crias) {
            const cria = animalPorIdeagri.get(c.animalIdeagriId)!;
            if (cria.dataNascimento.toISOString().slice(0, 10) !== f.data)
              throw new Error(
                "Nascimento da cria diverge do parto; reconciliação necessária.",
              );
            await tx.criaParto.create({
              data: {
                partoId: id,
                animalId: cria.id,
                viva: true,
                sexo: cria.sexo,
                ordem: c.ordem,
                filiacaoSnapshot: json({
                  origem: "IDEAGRI",
                  vinculoExplicito: true,
                  animalIdeagriId: c.animalIdeagriId,
                  maeId: cria.maeId,
                  maeExternaId: cria.maeExternaId,
                  paiId: cria.paiId,
                  paiExternoId: cria.paiExternoId,
                }),
              },
            });
          }
        } else if (f.tipo === "DIAGNOSTICO") {
          const tentativaId = f.tentativaChave
            ? (destinos.get(f.tentativaChave) ?? null)
            : null;
          if (f.tentativaChave && !tentativaId)
            throw new Error(
              "Tentativa comprovada não importada; vínculo não pode ser omitido.",
            );
          // O exame prova sua avaliação, mas não um encerramento de gestação histórica.
          // Não transformar vários positivos em gestações abertas/conflitantes.
          const gestacaoId = null;
          const exame = await registrarEvidenciaAvaliacaoTx(tx, {
              ...b,
              resultado: f.resultado ?? "INCONCLUSIVO",
              tentativaId,
              gestacaoId,
              anotacaoOriginal: JSON.stringify(f.snapshot),
          });
          id = exame.id;
        } else {
          const materialLegado = carga.animais.find(
            (x) =>
              x.id ===
              (f.tipo === "TE" ? f.snapshot.embriao : f.snapshot.reprodutor),
          );
          const t = await tx.tentativaReprodutiva.create({
            data: {
              ...b,
              tipo: f.tipo!,
              ciclo,
              ordem,
              origemMaterial: "HISTORICO",
              quantidade:
                f.quantidade === null ? null : new Prisma.Decimal(f.quantidade),
              geneticaSnapshot: json({
                origem: "IDEAGRI",
                referenciasLegadas: f.snapshot,
                materialLegado: materialLegado ?? null,
                semConsumoAtual: true,
              }),
              observacao:
                "Carga histórica; referências genéticas preservadas sem inferir filiação.",
            },
          });
          id = t.id;
        }
        await auditoria(
          tx,
          f.tipo === "PARTO"
            ? "PartoAnimal"
            : f.tipo === "DIAGNOSTICO"
              ? "AvaliacaoReprodutiva"
              : "TentativaReprodutiva",
          id,
          a.id,
          f,
          b.propriedadeId,
        );
        return id;
      },
    );
  }
  for (const l of carga.lactacoes) {
    const a = animalPorIdeagri.get(l.animalIdeagriId);
    if (!a) {
      bloquear(l.chaveExterna, "Animal não encontrado.");
      continue;
    }
    if (animaisOperacionais.has(a.id)) {
      bloquear(
        l.chaveExterna,
        "Animal já tem operação Fazendinha; período exige reconciliação.",
      );
      continue;
    }
    if (
      l.fim === null &&
      lactacoesAtuais.some(
        (x) =>
          x.animalId === a.id &&
          x.encerradaEm === null &&
          x.referenciaExterna !== referencia(mapa.bancoOrigem, l.chaveExterna),
      )
    ) {
      bloquear(
        l.chaveExterna,
        "Lactação aberta existente; não inferir encerramento.",
      );
      continue;
    }
    if (
      l.fim === null &&
      carga.lactacoes.filter(
        (x) => x.animalIdeagriId === l.animalIdeagriId && x.fim === null,
      ).length > 1
    ) {
      bloquear(
        l.chaveExterna,
        "Fonte tem múltiplas lactações abertas; reconciliar antes da carga.",
      );
      continue;
    }
    adicionar(l.chaveExterna, l, "LactacaoAnimal", async (tx) => {
      const partoId = l.partoChave
        ? (destinos.get(l.partoChave) ?? null)
        : null;
      if (l.partoChave && !partoId)
        throw new Error("Parto explicitamente vinculado não importado.");
      const registro = await tx.lactacaoAnimal.create({
        data: {
          referenciaExterna: referencia(mapa.bancoOrigem, l.chaveExterna),
          animalId: a.id,
          propriedadeId: local(a, l.inicio),
          partoId,
          inicio: data(l.inicio),
          encerradaEm: l.fim ? data(l.fim) : null,
          motivoEncerramento: l.snapshot.motivoSecagem
            ? JSON.stringify(l.snapshot)
            : null,
          origem: "IDEAGRI",
          criadoPorId: mapa.autorId,
        },
      });
      await auditoria(
        tx,
        "LactacaoAnimal",
        registro.id,
        a.id,
        l,
        local(a, l.inicio),
      );
      return registro.id;
    });
  }
  for (const p of carga.periodos) {
    const a = animalPorIdeagri.get(p.animalIdeagriId);
    if (!a) {
      bloquear(p.chaveExterna, "Animal não encontrado.");
      continue;
    }
    if (animaisOperacionais.has(a.id)) {
      bloquear(
        p.chaveExterna,
        "Animal possui fatos operacionais; reconciliar período sem alterar rotina atual.",
      );
      continue;
    }
    if (p.tipo === "DESCONHECIDO") {
      bloquear(p.chaveExterna, "Tipo de período legado não reconhecido.");
      continue;
    }
    adicionar(
      p.chaveExterna,
      p,
      p.tipo === "DESCARTE"
        ? "RestricaoReprodutiva"
        : "PeriodoReprodutivoAnimal",
      async (tx) => {
        if (p.tipo === "DESCARTE") {
          const r = await tx.restricaoReprodutiva.create({
            data: {
              referenciaExterna: referencia(mapa.bancoOrigem, p.chaveExterna),
              animalId: a.id,
              propriedadeId: local(a, p.inicio),
              data: data(p.inicio),
              ate: p.fim ? data(p.fim) : null,
              tipo: "DESCARTE",
              motivo:
                "Período de descarte documentado no IDEAGRI; motivo detalhado não informado.",
              acoes: ["IA", "TE", "COBERTURA", "IATF"],
              origem: "IDEAGRI",
              criadoPorId: mapa.autorId,
            },
          });
          await auditoria(
            tx,
            "RestricaoReprodutiva",
            r.id,
            a.id,
            p,
            local(a, p.inicio),
          );
          return r.id;
        }
        if (p.tipo !== "DOADORA" && p.tipo !== "RECEPTORA")
          throw new Error(
            "Tipo de período desconhecido; revisão explícita necessária.",
          );
        const registro = await tx.periodoReprodutivoAnimal.create({
          data: {
            referenciaExterna: referencia(mapa.bancoOrigem, p.chaveExterna),
            animalId: a.id,
            propriedadeId: local(a, p.inicio),
            tipo: p.tipo,
            inicio: data(p.inicio),
            fim: p.fim ? data(p.fim) : null,
            origem: "IDEAGRI",
            criadoPorId: mapa.autorId,
          },
        });
        await auditoria(
          tx,
          "PeriodoReprodutivoAnimal",
          registro.id,
          a.id,
          p,
          local(a, p.inicio),
        );
        return registro.id;
      },
    );
  }
  // Protocolos legados não têm doses/vias/precisão suficientes para publicação operacional.
  // Preservar programas, inscrições e etapas como fonte técnica auditada, sem criar tarefas
  // previstas, execuções, aplicações ou consumo presumidos.
  const fontesIatf = [
    ...carga.protocolos.map((r) => ({
      chave: `PROTOCOLOIATF:${r.id}`,
      registro: r,
    })),
    ...carga.etapas.map((r) => ({
      chave: `PROTOCOLOIATFPRINCIPIOATIVO:${r.id}`,
      registro: r,
    })),
    ...carga.programacoes.map((r) => ({
      chave: `PROGRAMACAOIATF:${r.id}`,
      registro: r,
    })),
    ...carga.participacoes.map((r) => ({
      chave: `PROGRAMACAOIATFASSOCIACAO:${r.id}`,
      registro: r,
    })),
  ];
  for (const fonte of fontesIatf) {
    adicionar(fonte.chave, fonte.registro, "AuditoriaPecuaria", async (tx) => {
      const a = animalPorIdeagri.get(num(fonte.registro.animal)!);
      const r = await tx.auditoriaPecuaria.create({
        data: {
          entidade: "IatfHistoricoIDEAGRI",
          entidadeId: referencia(mapa.bancoOrigem, fonte.chave),
          animalId: a?.id ?? null,
          acao: "IMPORTACAO",
          usuarioId: mapa.autorId,
          depois: json({
            tabela: fonte.chave.split(":")[0],
            original: fonte.registro,
            semExecucaoPresumida: true,
          }),
        },
      });
      return r.id;
    });
  }
  // Datas de aptidão não provam vazio/gestação. Registre a lacuna sem inventar estado.
  for (const original of carga.animais) {
    if (!original.aptidao) continue;
    const a = animalPorIdeagri.get(num(original.id)!);
    if (!a) continue;
    const chave = `APTIDAO:${original.id}`;
    if (animaisOperacionais.has(a.id)) {
      bloquear(
        chave,
        "Situação operacional já registrada; não substituir por snapshot IDEAGRI.",
      );
      continue;
    }
    adicionar(chave, original, "SituacaoInicialReprodutiva", async (tx) => {
      const r = await tx.situacaoInicialReprodutiva.create({
        data: {
          referenciaExterna: referencia(mapa.bancoOrigem, chave),
          animalId: a.id,
          propriedadeId: local(a, original.aptidao!),
          data: data(original.aptidao!),
          aptaDesde: data(original.aptidao!),
          situacao: "DESCONHECIDA",
          origem: "IDEAGRI",
          observacao:
            "DTAPTIDAO original; ausência de avaliação não é diagnóstico negativo.",
          criadoPorId: mapa.autorId,
        },
      });
      await auditoria(
        tx,
        "SituacaoInicialReprodutiva",
        r.id,
        a.id,
        original,
        local(a, original.aptidao!),
      );
      return r.id;
    });
  }
  const chavesPlanejadas = new Set(planos.map((p) => p.chave));
  for (const f of carga.fatos)
    if (
      f.tentativaChave &&
      !destinos.has(f.tentativaChave) &&
      !chavesPlanejadas.has(f.tentativaChave)
    )
      bloquear(
        f.chaveExterna,
        "Tentativa vinculada não está disponível para importação.",
      );
  for (const l of carga.lactacoes)
    if (
      l.partoChave &&
      !destinos.has(l.partoChave) &&
      !chavesPlanejadas.has(l.partoChave)
    )
      bloquear(
        l.chaveExterna,
        "Parto vinculado não está disponível para importação.",
      );
  relatorio.planejados = planos.length;
  if (!executar) return relatorio;
  // Conflitos impedem a execução inteira; prévia deve ser revisada antes de autorizar a carga.
  if (relatorio.conflitos.length) return relatorio;
  for (const item of planos) {
    try {
      const destinoId = await db.$transaction(
        async (tx) => {
          const [tabelaOrigem, chaveOrigem] = item.chave.split(":");
          const existente = await tx.vinculoImportacaoPecuaria.findUnique({
            where: {
              bancoOrigem_tabelaOrigem_chaveOrigem: {
                bancoOrigem: mapa.bancoOrigem,
                tabelaOrigem,
                chaveOrigem,
              },
            },
          });
          if (existente) {
            if (existente.hashOrigem !== item.hash)
              throw new Error("Origem alterada durante execução.");
            return existente.destinoId;
          }
          const id = await item.gravacao(tx);
          await tx.vinculoImportacaoPecuaria.create({
            data: {
              bancoOrigem: mapa.bancoOrigem,
              tabelaOrigem,
              chaveOrigem,
              hashOrigem: item.hash,
              entidadeDestino: item.entidade,
              destinoId: id,
            },
          });
          return id;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 30000,
        },
      );
      destinos.set(item.chave, destinoId);
      relatorio.importados++;
    } catch (e) {
      bloquear(item.chave, e instanceof Error ? e.message : String(e));
    }
  }
  return relatorio;
}
