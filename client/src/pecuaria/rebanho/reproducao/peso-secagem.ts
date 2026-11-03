import type { LactacaoReprodutiva, PesagemSecagem, PesoSecagemInput, PrecisaoPesoSecagem } from "./api";

export type DadosPesoSecagem = {
  acao: "NAO_INFORMAR" | "REGISTRAR" | "VINCULAR";
  data: string; pesoKg: string; origem: "MANUAL" | "BALANCA"; precisao: PrecisaoPesoSecagem;
  observacao: string; pesagemId: string; selecionada?: PesagemSecagem;
};
export const dadosPesoSecagemVazios = (): DadosPesoSecagem => ({ acao: "NAO_INFORMAR", data: "", pesoKg: "", origem: "MANUAL", precisao: "NAO_INFORMADO", observacao: "", pesagemId: "" });
export const vinculoSecagemAtivo = (lactacao: LactacaoReprodutiva) => lactacao.vinculosPesagemSecagem?.find(v => !v.revogadoEm) ?? null;
export function dadosDaPesagemSecagem(pesagem: PesagemSecagem): DadosPesoSecagem {
  return { ...dadosPesoSecagemVazios(), acao: "REGISTRAR", data: pesagem.data.slice(0, 10), pesoKg: String(pesagem.pesoKg), origem: pesagem.origem === "BALANCA" ? "BALANCA" : "MANUAL", precisao: pesagem.precisao ?? "NAO_INFORMADO", observacao: pesagem.observacao ?? "" };
}
export function incompatibilidadePesoSecagem(pesagem: PesagemSecagem, dataEncerramento: string, propriedadeId?: number | null): string | null {
  if (pesagem.data.slice(0, 10) !== dataEncerramento) return "Data diferente do encerramento";
  if (pesagem.contextoHistorico === "EXTERNO") return "Contexto externo";
  if (pesagem.propriedadeId != null && propriedadeId != null && pesagem.propriedadeId !== propriedadeId) return "Sítio diferente";
  return null;
}
export function validarPesoSecagem(dados: DadosPesoSecagem, dataEncerramento: string, propriedadeId?: number | null, permitirAusente = true): Record<string, string> {
  const erros: Record<string, string> = {};
  if (dados.acao === "NAO_INFORMAR") { if (!permitirAusente) erros.acao = "Escolha registrar ou reutilizar uma pesagem."; return erros; }
  if (dados.acao === "VINCULAR") {
    if (!dados.pesagemId || !dados.selecionada) erros.pesagemId = "Selecione a pesagem existente.";
    else if (incompatibilidadePesoSecagem(dados.selecionada, dataEncerramento, propriedadeId)) erros.pesagemId = "A pesagem selecionada não é compatível com a data e o sítio do encerramento.";
    return erros;
  }
  if (!dados.data) erros.data = "Informe a data real da pesagem.";
  else if (dados.data !== dataEncerramento) erros.data = "A data da pesagem deve ser igual à data do encerramento.";
  const peso = Number(dados.pesoKg);
  if (!Number.isFinite(peso) || peso < 0.01 || peso > 9999.99) erros.pesoKg = "Informe um peso entre 0,01 e 9.999,99 kg.";
  if (dados.origem === "BALANCA" && ["ESTIMADO", "INFORMADO"].includes(dados.precisao)) erros.precisao = "Balança não aceita peso estimado ou apenas informado.";
  return erros;
}
export function pesoSecagemPayload(dados: DadosPesoSecagem): Extract<PesoSecagemInput, { acao: "REGISTRAR" | "VINCULAR" | "NAO_INFORMAR" }> {
  if (dados.acao === "NAO_INFORMAR") return { acao: "NAO_INFORMAR" };
  if (dados.acao === "VINCULAR") return { acao: "VINCULAR", pesagemId: dados.pesagemId };
  return { acao: "REGISTRAR", data: dados.data, pesoKg: Number(dados.pesoKg), origem: dados.origem, precisao: dados.precisao, observacao: dados.observacao.trim() || null };
}

export function rotuloTipoPesoSecagem(tipo: string): string {
  return ({ NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída", PARTO: "Parto", SECAGEM: "Secagem" } as Record<string, string>)[tipo] ?? "Tipo não informado";
}
