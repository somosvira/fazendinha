import type {
  ConfigRecomendacao,
  TermoRecomendacao,
} from "./recomendar-acasalamento.calc.js";
import type { DirecaoIndicadorAcasalamento } from "./merito-acasalamento.calc.js";

export type TipoMedidaResolvida =
  | "MERITO"
  | "RESTRICAO_INDICADOR"
  | "CONSANGUINIDADE"
  | "PEDIGREE"
  | "SEMEN";

export interface MedidaResolvida {
  tipo: TipoMedidaResolvida;
  peso: number;
  obrigatoria: boolean;
  consanguinidadeMax: number | null;
  exigePedigree: boolean;
  itens: {
    indicadorId: number;
    peso: number;
    minimo: number | null;
    maximo: number | null;
  }[];
}

function validarFinito(valor: number, mensagem: string): void {
  if (!Number.isFinite(valor)) throw new Error(mensagem);
}

function termoDaMedida(
  medida: MedidaResolvida,
  direcoes: ReadonlyMap<number, DirecaoIndicadorAcasalamento>,
): TermoRecomendacao[] {
  if (medida.tipo !== "MERITO" && medida.tipo !== "RESTRICAO_INDICADOR") {
    return [];
  }

  validarFinito(medida.peso, "peso de medida inválido");
  return medida.itens.map((item) => {
    validarFinito(item.peso, "peso de item inválido");
    if (item.minimo !== null) validarFinito(item.minimo, "limite de indicador inválido");
    if (item.maximo !== null) validarFinito(item.maximo, "limite de indicador inválido");

    const direcao = direcoes.get(item.indicadorId);
    if (!direcao) {
      throw new Error(`indicador ${item.indicadorId} sem direção configurada`);
    }

    return {
      indicadorId: item.indicadorId,
      peso: item.peso * medida.peso,
      direcao,
      minimo: item.minimo,
      maximo: item.maximo,
      obrigatoria:
        medida.obrigatoria || medida.tipo === "RESTRICAO_INDICADOR",
    };
  });
}

export function configDaCombinacao(
  medidas: MedidaResolvida[],
  indicadoresDirecao: ReadonlyMap<number, DirecaoIndicadorAcasalamento>,
): ConfigRecomendacao {
  const limites = medidas
    .filter((medida) => medida.tipo === "CONSANGUINIDADE")
    .map((medida) => medida.consanguinidadeMax)
    .filter((limite): limite is number => limite !== null);

  for (const limite of limites) {
    if (!Number.isFinite(limite) || limite < 0 || limite > 1) {
      throw new Error("limite de consanguinidade inválido");
    }
  }

  return {
    termos: medidas.flatMap((medida) =>
      termoDaMedida(medida, indicadoresDirecao),
    ),
    consanguinidadeMax: limites.length === 0 ? 1 : Math.min(...limites),
    exigePedigree: medidas.some(
      (medida) => medida.tipo === "PEDIGREE" || medida.exigePedigree,
    ),
  };
}

export function configDefault(
  indicadoresRanking: readonly {
    indicadorId: number;
    direcao: DirecaoIndicadorAcasalamento;
  }[],
): ConfigRecomendacao {
  return {
    termos: indicadoresRanking.map(({ indicadorId, direcao }) => ({
      indicadorId,
      peso: 1,
      direcao,
      minimo: null,
      maximo: null,
      obrigatoria: false,
    })),
    consanguinidadeMax: 0.125,
    exigePedigree: false,
  };
}
