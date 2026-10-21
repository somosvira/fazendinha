import { parseAnimalId, parseLoteId } from "../../../router";

const BASE_LOCAL = "https://terrano.internal";
const ROTAS_RETORNO = new Set([
  "/pecuaria/rebanho", "/pecuaria/rebanho/animais", "/pecuaria/rebanho/lotes",
  "/pecuaria/sanidade", "/pecuaria/nutricao",
  "/pecuaria/rebanho/sanidade", "/pecuaria/rebanho/nutricao",
]);

/** Conserva o contexto da consulta sem permitir redirecionamento externo. */
export function validarRetornoRebanho(valor: string | null | undefined): string | null {
  if (!valor || !valor.startsWith("/") || valor.startsWith("//") || /[\\\u0000-\u001f]/.test(valor)) return null;
  try {
    const url = new URL(valor, BASE_LOCAL);
    if (url.origin !== BASE_LOCAL || (!ROTAS_RETORNO.has(url.pathname.replace(/\/$/, "")) && !parseAnimalId(url.pathname) && !parseLoteId(url.pathname))) return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function retornoRebanhoDaUrl(fallback = "/pecuaria/rebanho/animais"): string {
  return validarRetornoRebanho(new URLSearchParams(window.location.search).get("retorno")) ?? fallback;
}

export function rotuloRetornoRebanho(retorno: string): string {
  const caminho = new URL(retorno, BASE_LOCAL).pathname.replace(/\/$/, "");
  if (parseLoteId(caminho)) return "Lote";
  if (parseAnimalId(caminho)) return "Animal";
  if (caminho === "/pecuaria/rebanho/lotes") return "Lotes";
  if (caminho === "/pecuaria/rebanho") return "Rebanho";
  if (["/pecuaria/sanidade", "/pecuaria/rebanho/sanidade"].includes(caminho)) return "Sanidade";
  if (["/pecuaria/nutricao", "/pecuaria/rebanho/nutricao"].includes(caminho)) return "Nutrição";
  return "Animais";
}

export function contextoRebanhoAtual(): string {
  return window.location.pathname + window.location.search + window.location.hash;
}

function comRetorno(destino: string, retorno: string): string {
  const validado = validarRetornoRebanho(retorno);
  return destino + (validado ? `?${new URLSearchParams({ retorno: validado })}` : "");
}

export function linkFichaAnimal(id: string, retorno = contextoRebanhoAtual()): string {
  return comRetorno(`/pecuaria/rebanho/animais/${encodeURIComponent(id)}`, retorno);
}

export function linkFichaLote(id: string, retorno = contextoRebanhoAtual()): string {
  return comRetorno(`/pecuaria/rebanho/lotes/${encodeURIComponent(id)}`, retorno);
}

export function linkNovoAnimal(retorno = contextoRebanhoAtual()): string {
  return comRetorno("/pecuaria/rebanho/animais/novo", retorno);
}
