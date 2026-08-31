// Formatação de título de evento — usada tanto pelo mapper real do servidor
// (server/src/services/rebanho/eventos-sanidade.mappers.ts,
// server/src/services/rebanho/producao.mappers.ts) quanto pelo item otimista
// do client (criarOtimista de useOfflineMutation) — precisa bater byte a byte
// nos dois lados, senão o item pisca ao trocar do otimista pro real no sync.

type TipoEventoSanitario = "OCORRENCIA" | "APLICACAO" | "EXAME" | "MASTITE" | "VACINA";

export function tituloEventoSanitario(input: {
  tipo: TipoEventoSanitario;
  doenca?: string | null;
  produto?: string | null;
  ccs?: number | null;
  quarto?: string | null;
}): string {
  switch (input.tipo) {
    case "OCORRENCIA": return `Ocorrência — ${input.doenca}`;
    case "APLICACAO": return `Aplicação — ${input.produto}`;
    case "EXAME": return `Controle leiteiro — CCS ${input.ccs} mil`;
    case "MASTITE": return `Mastite${input.quarto ? ` — quarto ${input.quarto}` : ""}`;
    case "VACINA": return `Vacinação — ${input.produto}`;
  }
}

export function detalheEventoSanitario(input: {
  tipo: TipoEventoSanitario;
  diasTratamento?: number | null;
  dose?: string | null;
  carencia?: number | null;
  loteProduto?: string | null;
  gordura?: number | null;
  proteina?: number | null;
  severidade?: string | null;
  resultadoCultivo?: string | null;
  observacao?: string | null;
}): string | undefined {
  switch (input.tipo) {
    case "OCORRENCIA": return input.diasTratamento ? `${input.diasTratamento} dias de tratamento` : undefined;
    case "APLICACAO": return [
      input.dose && `dose ${input.dose}`,
      input.carencia != null && `carência ${input.carencia}h`,
      input.loteProduto && `lote ${input.loteProduto}`,
    ].filter(Boolean).join(" · ") || undefined;
    case "EXAME": return [
      input.gordura != null && `gordura ${input.gordura}%`,
      input.proteina != null && `proteína ${input.proteina}%`,
    ].filter(Boolean).join(" · ") || undefined;
    case "MASTITE": return [input.severidade, input.resultadoCultivo].filter(Boolean).join(" · ") || undefined;
    case "VACINA": return input.observacao ?? undefined;
  }
}

export function alertaEventoSanitario(input: { tipo: TipoEventoSanitario; ccs?: number | null }): boolean {
  switch (input.tipo) {
    case "OCORRENCIA": case "MASTITE": return true;
    case "EXAME": return (input.ccs ?? 0) >= 400;
    default: return false;
  }
}

export function tituloControleLeiteiro(pesoTotal: number): string {
  return `Controle leiteiro — ${pesoTotal} L/dia`;
}

export function detalheControleLeiteiro(input: { peso1?: number | null; peso2?: number | null; peso3?: number | null }): string | undefined {
  const ordenhas = [input.peso1, input.peso2, input.peso3]
    .map((p, i) => (p != null ? `ordenha ${i + 1}: ${p} L` : null))
    .filter(Boolean)
    .join(" · ");
  return ordenhas || undefined;
}
