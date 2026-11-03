/** Cenários antigos de coluna/paginação exercitam explicitamente a apresentação tabular. */
export function preferirTabelas() {
  let usuario = "sessao";
  try { usuario = String(JSON.parse(localStorage.getItem("rionovo:usuario") ?? "null")?.id ?? "sessao"); } catch { /* Sem sessão nos testes de componente. */ }
  for (const [dominio, chaves] of Object.entries({ consultas: ["visualContas", "visualExtrato", "visualOperacoes", "visualRelatorios", "visualAnimais"], sanidade: ["visualExames", "visualAplicacoes", "visualCarencias"], rebanho: ["visualHistoricoAnimal"], nutricao: ["visualDietasLote"] })) {
    for (const chave of chaves) localStorage.setItem(`terrano:${dominio}:${usuario}:${chave}`, "tabela");
  }
}
