import type { AchadoGinecologico, EventoPayload } from "../api";

const numeroOpcional = (valor: string): number | undefined => valor.trim() === "" ? undefined : Number(valor);

export function camposInseminacao(form: {
  reprodutor: string;
  protocolo: string | undefined;
}): Partial<EventoPayload> {
  return {
    reprodutor: form.reprodutor,
    protocolo: form.protocolo,
  };
}

export function camposTransferenciaEmbriao(form: {
  embriaoColetaId: string;
  doadoraId: string;
  semenTE: string;
  protocolo: string | undefined;
}): Partial<EventoPayload> {
  const protocolo = form.protocolo || undefined;
  const embriaoColetaId = Number(form.embriaoColetaId);
  if (Number.isInteger(embriaoColetaId) && embriaoColetaId > 0) {
    // Embrião do estoque FIV manda a genética: doadora/touro não vão no payload.
    return { protocolo, embriaoColetaId };
  }
  const doadoraId = numeroOpcional(form.doadoraId);
  const reprodutor = form.semenTE.trim() || undefined;
  return {
    protocolo,
    ...(doadoraId != null ? { doadoraId } : {}),
    ...(reprodutor ? { reprodutor } : {}),
  };
}

export interface CamposPartoForm {
  tipoParto: string;
  auxilioParto: string;
  numCrias: string;
  criasVivas: string;
  criasNatimortas: string;
  sexoCria: string;
  criaAcao: "nenhuma" | "criar" | "vincular";
  criaNumero: string;
  criaId: string;
}

export function camposParto(form: CamposPartoForm): Partial<EventoPayload> {
  if (form.tipoParto === "3") {
    return {
      tipoParto: form.tipoParto,
      auxilioParto: undefined,
      numCrias: 0,
      criasVivas: 0,
      criasNatimortas: 0,
    };
  }

  const vivos = numeroOpcional(form.criasVivas);
  const natimortos = numeroOpcional(form.criasNatimortas);
  const total = numeroOpcional(form.numCrias) ?? ((vivos ?? 0) + (natimortos ?? 0) || 1);
  return {
    tipoParto: form.tipoParto || undefined,
    auxilioParto: form.tipoParto === "2" ? (form.auxilioParto || undefined) : undefined,
    numCrias: total,
    criasVivas: vivos ?? (form.tipoParto === "4" ? 0 : total),
    criasNatimortas: natimortos ?? (form.tipoParto === "4" ? total : 0),
    ...(form.sexoCria ? { sexoCria: form.sexoCria } : {}),
    ...(form.criaAcao === "criar" ? {
      criarCria: true,
      criaNumero: form.criaNumero.trim() || undefined,
    } : {}),
    ...(form.criaAcao === "vincular" ? {
      criarCria: undefined,
      criaId: numeroOpcional(form.criaId),
    } : {}),
  };
}

export function camposExameGinecologico(form: {
  achado: string;
  metodoExame: string;
  resultadoGinecologicoId: string;
}): Partial<EventoPayload> {
  return {
    resultado: form.achado as AchadoGinecologico,
    metodo: form.metodoExame || undefined,
    resultadoGinecologicoId: numeroOpcional(form.resultadoGinecologicoId),
  };
}
