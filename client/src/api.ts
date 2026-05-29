/* Cliente HTTP minimalista para a API do Rio Novo.
 * Backend está em outra porta; Vite faz proxy de /api → 41873 (vite.config.ts).
 */

import { buildSubcategorias, buildVolumeLeite, fornecedores } from "./data/cockpitSupplements";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} em ${path}: ${body || res.statusText}`);
  }
  return res.json();
}

/**
 * GET /api/dashboard — agregados (timeline 23m, DRE 2025/2026YTD, categorias top 12, etc.).
 *
 * Compat: o frontend foi escrito contra o mock onde `categoriasReais[i].grupo`
 * é o display da atividade ("Atv. Leiteira") e `subgrupo` é o GrupoCategoria.
 * O backend devolve `grupo = GrupoCategoria`. Reescreve aqui para casar.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchDashboard(): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d: any = await getJson("/dashboard");

  const atvLabel: Record<string, string> = {
    leite: "Atv. Leiteira",
    cafe: "Plantio Café",
    outros: "Outros / Estrutural",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  d.categoriasReais = (d.categoriasReais ?? []).map((c: any) => ({
    ...c,
    subgrupo: c.grupo,
    grupo: atvLabel[c.atividade] ?? c.grupo ?? "—",
  }));

  // Suplementos que o backend ainda não modela (subcategorias, fornecedores,
  // volume de leite). Casados por nome de categoria — ver cockpitSupplements.ts.
  d.subcategorias = buildSubcategorias(d.categoriasReais);
  d.fornecedores = fornecedores;
  if (d.k2025 && d.k2026YTD) {
    d.volumeLeite = buildVolumeLeite(d.k2025, d.k2026YTD);
  }

  return d;
}
