// Templates de mensagens que o bot envia. Centralizado pra facilitar revisão de
// copy. Tudo em PT-BR. Datas humanas em dd/mm/aaaa, valores em BRL com vírgula.

import type { ExtracaoNF } from "../../lib/visionExtractor.js";

const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const fmtData = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

export function cartaoConfirmacao(extracao: ExtracaoNF, opts: { overrideAnterior: boolean }): string {
  const itens = extracao.itens
    .slice(0, 4)
    .map((i) => `• ${i.descricao}${i.valor ? ` — ${fmtBRL(i.valor)}` : ""}`)
    .join("\n");
  const itensMais = extracao.itens.length > 4 ? `\n   _… +${extracao.itens.length - 4} item(ns)_` : "";

  const aviso = opts.overrideAnterior
    ? "⚠️ A foto anterior foi descartada — vamos com essa nova.\n\n"
    : "";

  const conf = extracao.confiancaGlobal === "alta"
    ? ""
    : extracao.confiancaGlobal === "media"
      ? "\n_⚠️ Algum campo ficou ambíguo — confira com calma._"
      : "\n_⚠️ Confiança baixa — pode ter erro na leitura._";

  return (
    `${aviso}📄 *NOTA LIDA — confirmar?*\n` +
    `*Fornecedor:* ${extracao.fornecedor || "(não identificado)"}\n` +
    `*Valor:* ${fmtBRL(extracao.valorTotal)}\n` +
    `*Data:* ${fmtData(extracao.dataEmissao)}\n` +
    (extracao.cnpj ? `*CNPJ:* ${extracao.cnpj}\n` : "") +
    (extracao.categoriaSugerida ? `*Categoria:* ${extracao.categoriaSugerida}\n` : "") +
    (extracao.centroCustoSugerido ? `*Atividade:* ${extracao.centroCustoSugerido}\n` : "") +
    (itens ? `\n${itens}${itensMais}\n` : "") +
    conf +
    `\n\nResponda *1* para confirmar ou *2* para cancelar.`
  );
}

export const MSG_NAO_AUTORIZADO = null; // silêncio absoluto

export const MSG_TIPO_NAO_SUPORTADO =
  "Só leio foto de nota fiscal ou DANFE em PDF. Mande novamente como imagem ou PDF.";

export const MSG_ARQUIVO_GRANDE =
  "Arquivo grande demais (máx. 10 MB). Tire uma foto com menos resolução e reenvie.";

export function msgValidacaoFalhou(motivo: string): string {
  return `Não consegui aceitar essa foto: ${motivo}\n\nTire outra foto e mande de novo.`;
}

export function msgDuplicata(lancamentoId: number): string {
  return `Essa nota fiscal já foi lançada antes (lançamento #${lancamentoId}). Nada a fazer.`;
}

export const MSG_EXTRACAO_FALHOU =
  "Não consegui ler essa nota — a foto pode estar borrada, escura ou cortada. Tire outra e tente de novo.";

export const MSG_AGUARDANDO_RESPOSTA =
  "Responda *1* para confirmar ou *2* para cancelar a nota anterior.";

export const MSG_AJUSTAR_INDISPONIVEL =
  "Ajustar pela web ainda não está integrado. Confirme aqui ou cancele e cadastre pelo app.";

export const MSG_SEM_SESSAO =
  "Não tenho nenhuma nota pra confirmar agora. Manda a foto primeiro 📸";

export function msgLancado(lancamentoId: number, valor: number, fornecedor: string): string {
  return `✅ Lançado #${lancamentoId} — ${fornecedor} — ${fmtBRL(valor)}\n\nAparece no dashboard em segundos.`;
}

export const MSG_CANCELADO = "Descartado. Manda outra foto quando quiser.";

export function msgMesFechado(mesAno: string): string {
  return `Essa nota é de ${mesAno}, mês já fechado contabilmente. Não posso lançar pelo WhatsApp — fale com a contabilidade.`;
}

export const MSG_ERRO_INTERNO =
  "Tive um problema interno processando essa nota. Tente em alguns minutos.";
