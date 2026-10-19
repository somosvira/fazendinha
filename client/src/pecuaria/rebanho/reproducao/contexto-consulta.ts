import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { navegarPara } from "../../../router";

function sitioDaUrl(): number | null {
  const valor = new URLSearchParams(window.location.search).get("sitio");
  if (!valor || !/^\d+$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Preserva o sítio efetivo, inclusive o escolhido localmente em Consolidado.
 * O destino conserva sua query e seu fragmento; filtros de outra tela não são copiados.
 * O sítio explícito permite transportar a resolução de ConsultaPorSitio (inclusive sítio único).
 * A autorização e a validação do sítio continuam no destino e no servidor. */
export function urlConsultaComSitio(destino: string, sitioId?: number): string {
  const url = new URL(destino, window.location.href);
  const efetivo = sitioId ?? getPropriedadeAtiva() ?? sitioDaUrl();
  if (efetivo != null) url.searchParams.set("sitio", String(efetivo));
  return url.pathname + url.search + url.hash;
}

export function navegarConsultaComSitio(destino: string, sitioId?: number): void {
  navegarPara(urlConsultaComSitio(destino, sitioId));
}
