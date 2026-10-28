import { idadeEmMeses } from "../../rebanho/categoria.calc.js";
import { publicoProgramacaoSchema } from "./schemas.js";
import { janelaProgramacao, type CalendarioProgramacao } from "./calendario.calc.js";
export function elegivelProgramacao(publico: unknown, animal: { sexo: string; dataNascimento: Date }, hoje: Date): boolean {
  const resultado = publicoProgramacaoSchema.safeParse(publico);
  if (!resultado.success || resultado.data.criterioPendente || !Number.isFinite(animal.dataNascimento.getTime()) || animal.dataNascimento > hoje) return false;
  const p = resultado.data; const idade = idadeEmMeses(animal.dataNascimento, hoje);
  return (!p.sexo || p.sexo === animal.sexo) && (p.idadeMinimaMeses == null || idade >= p.idadeMinimaMeses) && (p.idadeMaximaMeses == null || idade <= p.idadeMaximaMeses);
}
export function janelaPublicavel(p: CalendarioProgramacao & { antecedenciaDias: number; ativadoEm: Date | null }, hoje: Date) {
  // Mês continua sendo uma janela sem dia. Uma data diária perdida exige conferência, sem atraso clínico.
  const anos = new Set([hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]);
  if (p.precisao === "DIA") {
    if (p.recorrencia === "SEM_REPETICAO" && p.ano != null) anos.add(p.ano);
    else anos.add(hoje.getUTCFullYear() - 1);
  }
  const janelas = [...anos].flatMap(ano => p.meses.flatMap(mes => {
    const janela = janelaProgramacao(p, ano, mes); if (!janela) return [];
    const inicio = new Date(`${janela.inicioJanela}T00:00:00Z`), fim = new Date(`${janela.fimJanela}T00:00:00Z`);
    const visivelDesde = new Date(inicio.getTime() - p.antecedenciaDias * 86400000);
    if (hoje < visivelDesde) return [];
    const perdida = hoje > fim;
    if (perdida && (p.precisao !== "DIA" || p.recorrencia !== "SEM_REPETICAO" && (!p.ativadoEm || fim < p.ativadoEm))) return [];
    const adocaoTardia = p.ativadoEm != null && p.ativadoEm > inicio;
    return [{ ...janela, situacao: perdida || adocaoTardia ? "CONFERENCIA_INICIAL" : hoje < inicio ? "PROXIMO" : "PENDENTE", visivelDesde }];
  }));
  // Retoma só a edição diária mais recente; não reconstrói campanhas antigas em massa.
  const perdidas = janelas.filter(j => j.fimJanela < hoje.toISOString().slice(0, 10)).sort((a, b) => b.inicioJanela.localeCompare(a.inicioJanela));
  return [...perdidas.slice(0, 1), ...janelas.filter(j => j.fimJanela >= hoje.toISOString().slice(0, 10))];
}
