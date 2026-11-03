import { travarRotinaLeiteTx } from "../../pecuaria/leite/configuracoes.js";
import { Prisma } from "@prisma/client";
import { AssistenteError } from "../tipos.js";
export interface DiaGeral {
  dataOperacional: Date;
  configuracao: { fonteProducao: string; ordenhas: { posicaoId: string }[] };
  sessoes: {
    posicaoId: string;
    medicoesGerais: {
      id: string;
      litros: Prisma.Decimal;
      natureza: string;
      entradasEstoque: { status: string }[];
    }[];
  }[];
}
export function calcularVolumeGeral(dia: DiaGeral | null) {
  if (
    !dia ||
    dia.configuracao.fonteProducao !== "GERAL" ||
    !dia.configuracao.ordenhas.length
  )
    throw new AssistenteError(
      "VALIDACAO",
      "Sem cobertura de produção geral para esta data. Use uma meta manual quando a fonte for individual.",
    );
  const parcelas = dia.configuracao.ordenhas.flatMap((o) => {
    const sessao = dia.sessoes.find((s) => s.posicaoId === o.posicaoId);
    if (!sessao?.medicoesGerais.length)
      throw new AssistenteError(
        "VALIDACAO",
        "Ordenha sem parcelas: cobertura diária incompleta.",
      );
    return sessao.medicoesGerais;
  });
  if (
    parcelas.some(
      (p) => !p.entradasEstoque.some((e) => e.status === "CONFIRMADA"),
    )
  )
    throw new AssistenteError(
      "VALIDACAO",
      "Há parcelas sem confirmação no estoque. Apuração automática indisponível.",
    );
  return {
    valor: parcelas
      .reduce((s, p) => s.plus(p.litros), new Prisma.Decimal(0))
      .toNumber(),
    observacao: `Produção geral diária confirmada; todas as naturezas, sem somar controle individual. ${parcelas.length} parcela(s). Cobertura: todas as posições configuradas com parcelas confirmadas; não comprova ausência de parcelas não lançadas.`,
    proveniencia: {
      adaptador: "LEITE_GERAL_DIARIO_V1",
      parcelas: parcelas.map((p) => ({
        id: p.id,
        natureza: p.natureza,
        litros: p.litros.toString(),
      })),
    },
  };
}
export async function apurarVolumeGeral(
  tx: Prisma.TransactionClient,
  propriedadeId: number,
  data: string,
) {
  await travarRotinaLeiteTx(tx, propriedadeId);
  const dia = await tx.diaProducaoLeite.findUnique({
    where: {
      propriedadeId_dataOperacional: {
        propriedadeId,
        dataOperacional: new Date(`${data}T00:00:00Z`),
      },
    },
    include: {
      configuracao: { include: { ordenhas: { select: { posicaoId: true } } } },
      sessoes: {
        include: {
          medicoesGerais: {
            include: { entradasEstoque: { select: { status: true } } },
          },
        },
      },
    },
  });
  const apuracao = calcularVolumeGeral(dia);
  return {
    ...apuracao,
    proveniencia: {
      ...apuracao.proveniencia,
      url: `/pecuaria/leite?propriedadeId=${propriedadeId}&leiteSecao=ordenhas&leiteModo=geral&ordenhasInicio=${data}&ordenhasFim=${data}`,
    },
  };
}
