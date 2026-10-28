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
  // Somente a janela corrente ou a próxima dentro da antecedência. Nunca cria atraso passado na adoção.
  const anos = new Set([hoje.getUTCFullYear(), hoje.getUTCFullYear() + 1]);
  return [...anos].flatMap(ano => p.meses.flatMap(mes => {
    const janela = janelaProgramacao(p, ano, mes); if (!janela) return [];
    const inicio = new Date(`${janela.inicioJanela}T00:00:00Z`), fim = new Date(`${janela.fimJanela}T00:00:00Z`);
    const visivelDesde = new Date(inicio.getTime() - p.antecedenciaDias * 86400000);
    if (hoje < visivelDesde || hoje > fim) return [];
    const adocaoTardia = p.ativadoEm != null && p.ativadoEm > inicio;
    return [{ ...janela, situacao: adocaoTardia ? "CONFERENCIA_INICIAL" : hoje < inicio ? "PROXIMO" : "PENDENTE", visivelDesde }];
  }));
}
