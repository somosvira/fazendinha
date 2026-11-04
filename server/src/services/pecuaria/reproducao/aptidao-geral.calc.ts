import { concluirAptidaoClinica } from "./toque-aptidao.calc.js";
import type { EntradaElegibilidade } from "./elegibilidade.calc.js";
export type AptidaoReprodutiva = {
  estado: "APTA" | "NAO_APTA" | "PENDENTE";
  finalidadePrincipal: string | null; bloqueioAnteriorId: string | null;
  exameId: string | null; data: string | null; retornoEm: string | null;
  motivos: string[];
};
/** Uma conclusão geral sustentada por exame; não cria fatos ao consultar. */
export function projetarAptidaoReprodutiva(input: EntradaElegibilidade): AptidaoReprodutiva {
  const ref = input.referencia;
  const exames = (input.toques ?? []).filter(e => e.animalId === input.animalId && e.propriedadeId === input.propriedadeId && (!input.ciclo || e.data >= input.ciclo.inicioCiclo));
  const conclusao = concluirAptidaoClinica(exames, ref);
  let estado: AptidaoReprodutiva["estado"] = conclusao.estado === "NAO_DETERMINADA" ? "PENDENTE" : conclusao.estado;
  const motivos: string[] = [];
  const impedir = (m: string) => { estado = "NAO_APTA"; motivos.push(m); };
  const aguardar = (m: string) => { if (estado !== "NAO_APTA") estado = "PENDENTE"; motivos.push(m); };
  if (!conclusao.exameId) aguardar("EXAME_APTIDAO_NECESSARIO");
  else if (conclusao.estado === "NAO_DETERMINADA") aguardar("APTIDAO_INCONCLUSIVA");
  else if (conclusao.estado === "NAO_APTA") motivos.push("EXAME_NAO_APTA");
  const exameEm = conclusao.data ? new Date(`${conclusao.data}T00:00:00Z`) : null;
  const impedimentos = [...input.restricoes, ...(input.impedimentosSanitarios ?? [])].filter(r => r.status === "VALIDO" && r.data <= ref);
  for (const r of impedimentos) {
    if (!r.ate || r.ate > ref) impedir("CONDICAO_IMPEDITIVA_VIGENTE");
    else if (!exameEm || exameEm <= r.ate) aguardar("NOVO_EXAME_APOS_TRATAMENTO");
  }
  if (input.perdaGestacionalEm && input.perdaGestacionalEm <= ref && (!exameEm || exameEm <= input.perdaGestacionalEm)) aguardar("EXAME_APOS_PERDA_NECESSARIO");
  // Uma anulação posterior não ressuscita silenciosamente uma conclusão antiga.
  const exameAtual = exames.find(e => e.id === conclusao.exameId);
  if (exames.some(e => e.status !== "VALIDO" && e.data <= ref && (!exameAtual || e.data > exameAtual.data || (e.data.getTime() === exameAtual.data.getTime() && e.atualizadoEm >= exameAtual.atualizadoEm)))) aguardar("EXAME_ANULADO_REAVALIAR");
  const decisao = [...input.decisoes].filter(d => d.status === "VALIDO" && d.data <= ref && (!input.ciclo || d.data >= input.ciclo.inicioCiclo)).sort((a,b) => b.data.getTime()-a.data.getTime() || b.criadoEm.getTime()-a.criadoEm.getTime())[0];
  if (decisao?.tipo === "BLOQUEAR") impedir("BLOQUEIO_INDIVIDUAL");
  if (decisao?.tipo === "RETOMAR_POLITICA" && (!exameEm || exameEm <= decisao.data)) aguardar("NOVO_EXAME_APOS_TRATAMENTO");
  if (input.descarte) impedir("MATRIZ_DESCARTE");
  if (input.sexo !== "F") impedir("ANIMAL_NAO_FEMEA");
  if (input.baixaEm && input.baixaEm <= ref) impedir("ANIMAL_BAIXADO");
  if (input.localizacaoConflitante) aguardar("LOCALIZACOES_CONFLITANTES");
  else if (input.propriedadeNaData === null) aguardar("LOCALIZACAO_DESCONHECIDA");
  else if (input.propriedadeNaData !== input.propriedadeId) impedir("FORA_DO_SITIO");
  if (input.situacaoReprodutiva === "GESTANTE") impedir("GESTACAO_CONFIRMADA");
  if (input.situacaoReprodutiva === "AGUARDANDO_DIAGNOSTICO") aguardar("DIAGNOSTICO_PENDENTE");
  for (const m of input.pendenciasContexto ?? []) aguardar(m);
  return { estado, finalidadePrincipal: exames.find(e => e.id === conclusao.exameId)?.finalidadePrincipal ?? null, bloqueioAnteriorId: decisao?.tipo === "BLOQUEAR" ? decisao.id : null, exameId: conclusao.exameId, data: conclusao.data, retornoEm: conclusao.retornoEm, motivos: [...new Set(motivos)] };
}
