/** Cenários antigos de coluna/paginação exercitam explicitamente a apresentação tabular. */
export function preferirTabelas() {
  let usuario = "sessao";
  try { usuario = String(JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null")?.id ?? "sessao"); } catch { /* Sem sessão nos testes de componente. */ }
  for (const [dominio, chaves] of Object.entries({ consultas: ["visualContas", "visualExtrato", "visualOperacoes", "visualRelatorios", "visualAnimais"], sanidade: ["visualExames", "visualAplicacoes", "visualCarencias"], rebanho: ["visualHistoricoAnimal"], nutricao: ["visualDietasLote"] })) {
    for (const chave of chaves) localStorage.setItem(`terrano:${dominio}:${usuario}:${chave}`, "tabela");
  }
}

/** Cenários que exercitam os cartões fixam essa apresentação (o padrão das listas é tabela). */
export function preferirCartoes(chaves: Record<string, string[]>) {
  let usuario = "sessao";
  try { usuario = String(JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null")?.id ?? "sessao"); } catch { /* Sem sessão nos testes de componente. */ }
  for (const [dominio, lista] of Object.entries(chaves)) for (const chave of lista) localStorage.setItem(`terrano:${dominio}:${usuario}:${chave}`, "visual");
}
