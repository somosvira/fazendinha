import {
  calcularMeritos,
  type TermoMedida,
  type ValorPorIndicador,
} from "./merito-acasalamento.calc.js";
import {
  coeficienteParentesco,
  pedigreeVerificavel,
  type Genealogia,
} from "./parentesco.calc.js";

export type StatusCandidatoAcasalamento =
  | "ok"
  | "consanguineo"
  | "restrito"
  | "nao_verificavel";

export interface TermoRecomendacao extends TermoMedida {
  obrigatoria: boolean;
}

export interface CandidatoAcasalamento {
  id: number;
  nome: string;
  genealogia: Genealogia;
  valores: ValorPorIndicador[];
}

export interface ConfigRecomendacao {
  termos: TermoRecomendacao[];
  consanguinidadeMax: number;
  exigePedigree: boolean;
}

export interface CandidatoRecomendado {
  reprodutorId: number;
  nome: string;
  merito: number;
  parentesco: number;
  status: StatusCandidatoAcasalamento;
  score: number;
  motivos: string[];
  indicadoresPontuados: number;
}

function arredondarSeisCasas(valor: number): number {
  return Math.round(valor * 1_000_000) / 1_000_000;
}

function formatarNumero(valor: number): string {
  return Number(valor.toFixed(6)).toString();
}

function formatarPercentual(valor: number): string {
  return Number((valor * 100).toFixed(3)).toString();
}

function motivoViolacao(
  violacao: {
    indicadorId: number;
    tipo: "minimo" | "maximo";
    limite: number;
  },
  alerta: boolean,
): string {
  const comparacao =
    violacao.tipo === "minimo" ? "abaixo do mínimo" : "acima do máximo";
  const prefixo = alerta ? "alerta: " : "";
  return `${prefixo}indicador ${violacao.indicadorId} ${comparacao} ${formatarNumero(violacao.limite)}`;
}

const prioridadeStatus: Record<StatusCandidatoAcasalamento, number> = {
  ok: 0,
  nao_verificavel: 1,
  consanguineo: 2,
  restrito: 3,
};

export function recomendarAcasalamento(
  femea: Genealogia,
  candidatos: readonly CandidatoAcasalamento[],
  config: ConfigRecomendacao,
): CandidatoRecomendado[] {
  if (
    !Number.isFinite(config.consanguinidadeMax) ||
    config.consanguinidadeMax < 0 ||
    config.consanguinidadeMax > 1
  ) {
    throw new Error("limite de consanguinidade inválido");
  }

  const meritos = calcularMeritos(candidatos, config.termos);
  const indicadoresObrigatorios = new Set(
    config.termos
      .filter(({ obrigatoria }) => obrigatoria)
      .map(({ indicadorId }) => indicadorId),
  );

  return candidatos
    .map((candidato, indice): CandidatoRecomendado => {
      const resultadoMerito = meritos[indice];
      if (!resultadoMerito) {
        throw new Error("resultado de mérito ausente");
      }

      const parentesco = arredondarSeisCasas(
        coeficienteParentesco(femea, candidato.genealogia),
      );
      const violacoesDuras = resultadoMerito.violacoes.filter(({ indicadorId }) =>
        indicadoresObrigatorios.has(indicadorId),
      );
      const alertas = resultadoMerito.violacoes.filter(
        ({ indicadorId }) => !indicadoresObrigatorios.has(indicadorId),
      );

      let status: StatusCandidatoAcasalamento;
      let motivos: string[];

      if (parentesco > config.consanguinidadeMax) {
        status = "consanguineo";
        motivos = [
          `parentesco ${formatarPercentual(parentesco)}% acima do limite de ${formatarPercentual(config.consanguinidadeMax)}%`,
        ];
      } else if (violacoesDuras.length > 0) {
        status = "restrito";
        motivos = violacoesDuras.map((violacao) =>
          motivoViolacao(violacao, false),
        );
      } else if (!pedigreeVerificavel(femea, candidato.genealogia)) {
        status = "nao_verificavel";
        motivos = ["pedigree insuficiente para verificar consanguinidade"];
      } else if (resultadoMerito.indicadoresPontuados === 0) {
        status = "ok";
        motivos = ["sem indicadores genéticos cadastrados"];
      } else {
        status = "ok";
        const sufixo =
          resultadoMerito.indicadoresPontuados === 1
            ? "indicador"
            : "indicadores";
        motivos = [
          `mérito genético calculado com ${resultadoMerito.indicadoresPontuados} ${sufixo}`,
        ];
      }

      motivos.push(
        ...alertas.map((violacao) => motivoViolacao(violacao, true)),
      );

      const merito = arredondarSeisCasas(resultadoMerito.merito);
      return {
        reprodutorId: candidato.id,
        nome: candidato.nome,
        merito,
        parentesco,
        status,
        score:
          status === "consanguineo" || status === "restrito" ? 0 : merito,
        motivos,
        indicadoresPontuados: resultadoMerito.indicadoresPontuados,
      };
    })
    .sort((a, b) => {
      const porStatus = prioridadeStatus[a.status] - prioridadeStatus[b.status];
      if (porStatus !== 0) return porStatus;

      const porScore = b.score - a.score;
      if (porScore !== 0) return porScore;

      return a.reprodutorId - b.reprodutorId;
    });
}
