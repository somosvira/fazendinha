import { derivarCrias, ehAborto, ehNatimortoTotal } from "./parto.dict.js";

export interface PartoParaCrias {
  data: string;
  tipoParto?: string | null;
  numCrias?: number | null;
  criasVivas?: number | null;
  criasNatimortas?: number | null;
  sexoCria?: string | null;
  criarCria?: boolean;
  criaNumero?: string;
  criaId?: number;
}

export type NovaCriaPlano =
  | {
    tipo: "CRIAR";
    numero: string;
    sexo: "F" | "M";
    categoria: "BEZERRA" | "BEZERRO";
    maeId: number;
    dataNascimento: string;
  }
  | {
    tipo: "VINCULAR";
    criaId: number;
    sexo: "F" | "M";
    categoria: "BEZERRA" | "BEZERRO";
    maeId: number;
    dataNascimento: string;
  };

function sexosDasCrias(raw: string | null | undefined, quantidade: number): ("F" | "M")[] {
  const validos = (raw ?? "").toUpperCase().split("").filter((sexo): sexo is "F" | "M" => sexo === "F" || sexo === "M");
  if (validos.length === 0) return Array.from({ length: quantidade }, () => "F");
  return Array.from({ length: quantidade }, (_, indice) => validos[indice] ?? validos[0]);
}

export function planejarCrias(
  parto: PartoParaCrias,
  receptoraId: number,
  doadoraId: number | null,
): NovaCriaPlano[] {
  if (ehAborto(parto.tipoParto) || ehNatimortoTotal(parto.tipoParto)) return [];
  const { vivos } = derivarCrias(parto.tipoParto, parto.numCrias, parto.criasVivas, parto.criasNatimortas);
  if ((vivos ?? 0) < 1) return [];

  const maeId = doadoraId ?? receptoraId;
  const sexos = sexosDasCrias(parto.sexoCria, vivos!);
  if (parto.criaId != null) {
    const sexo = sexos[0];
    return [{
      tipo: "VINCULAR",
      criaId: parto.criaId,
      sexo,
      categoria: sexo === "F" ? "BEZERRA" : "BEZERRO",
      maeId,
      dataNascimento: parto.data,
    }];
  }
  if (!parto.criarCria || !parto.criaNumero) return [];

  return sexos.map((sexo, indice) => ({
    tipo: "CRIAR" as const,
    numero: indice === 0 ? parto.criaNumero! : `${parto.criaNumero}-${indice + 1}`,
    sexo,
    categoria: sexo === "F" ? "BEZERRA" as const : "BEZERRO" as const,
    maeId,
    dataNascimento: parto.data,
  }));
}
