import type { RacaDTO } from "../api";

// Frações comuns de grau de sangue. "8/8" = puro (sem segundo sangue).
export const FRACOES = [
  { id: "8/8",   num: 8,  den: 8,  label: "Puro (8/8)" },
  { id: "7/8",   num: 7,  den: 8,  label: "7/8" },
  { id: "3/4",   num: 6,  den: 8,  label: "3/4 (6/8)" },
  { id: "5/8",   num: 5,  den: 8,  label: "5/8" },
  { id: "1/2",   num: 4,  den: 8,  label: "1/2 (4/8)" },
  { id: "3/8",   num: 3,  den: 8,  label: "3/8" },
  { id: "1/4",   num: 2,  den: 8,  label: "1/4 (2/8)" },
  { id: "1/8",   num: 1,  den: 8,  label: "1/8" },
  { id: "15/16", num: 15, den: 16, label: "15/16" },
  { id: "13/16", num: 13, den: 16, label: "13/16" },
  { id: "11/16", num: 11, den: 16, label: "11/16" },
  { id: "9/16",  num: 9,  den: 16, label: "9/16" },
  { id: "7/16",  num: 7,  den: 16, label: "7/16" },
  { id: "5/16",  num: 5,  den: 16, label: "5/16" },
  { id: "3/16",  num: 3,  den: 16, label: "3/16" },
  { id: "1/16",  num: 1,  den: 16, label: "1/16" },
];

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

// Complemento da fração principal (ex.: 5/8 → 3/8). "" se for puro.
export function complementoLabel(fracId: string): string {
  const f = FRACOES.find((x) => x.id === fracId);
  if (!f) return "";
  const compNum = f.den - f.num;
  if (compNum === 0) return "";
  const d = gcd(compNum, f.den);
  return `${compNum / d}/${f.den / d}`;
}

export const codigoDaRaca = (r: RacaDTO | undefined): string =>
  (r?.codigo ?? r?.nome.slice(0, 2).toUpperCase() ?? "").trim();

// String composta no padrão BPO: "5/8 GL, HO". Retorna null para raça pura.
export function montarGrauSangue(fracId: string, primaria: RacaDTO | undefined, secundaria: RacaDTO | undefined): string | null {
  if (!primaria || fracId === "8/8") return null;
  const cp = codigoDaRaca(primaria);
  if (!secundaria) return `${fracId} ${cp}`;
  return `${fracId} ${cp}, ${codigoDaRaca(secundaria)}`;
}

// "Gir Leiteiro 5/8 GL, HO" (com nome) ou apenas "Gir Leiteiro" (pura).
export function montarRacaDisplay(fracId: string, primaria: RacaDTO | undefined, secundaria: RacaDTO | undefined): string {
  if (!primaria) return "";
  const grau = montarGrauSangue(fracId, primaria, secundaria);
  return grau ? `${primaria.nome} ${grau}` : primaria.nome;
}

// Tenta interpretar uma string legada (ex.: "5/8 GL, HO") em fração + sigla secundária.
export function parseGrauSangue(grauSangue: string | null | undefined, racas: RacaDTO[]): { fracId: string; racaSecundariaId: string } {
  if (!grauSangue) return { fracId: "8/8", racaSecundariaId: "" };
  const m = grauSangue.match(/^(\d+\/\d+)\s+([A-Z]{2})(?:\s*,\s*([A-Z]{2}))?\s*$/);
  if (!m) return { fracId: "8/8", racaSecundariaId: "" };
  const frac = FRACOES.find((x) => x.id === m[1]);
  const codSec = m[3];
  const sec = codSec ? racas.find((r) => r.codigo === codSec) : undefined;
  return { fracId: frac?.id ?? "8/8", racaSecundariaId: sec ? String(sec.id) : "" };
}
