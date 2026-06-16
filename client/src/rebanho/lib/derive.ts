const MS_DIA = 86_400_000;

export function diffDias(de: string, ate: string): number {
  return Math.round((Date.parse(ate) - Date.parse(de)) / MS_DIA);
}

export function del(dataParto: string | undefined, hoje: string): number | undefined {
  if (!dataParto) return undefined;
  return diffDias(dataParto, hoje);
}

export function idadeMeses(dataNascimento: string, hoje: string): number {
  const n = new Date(dataNascimento);
  const h = new Date(hoje);
  return (h.getFullYear() - n.getFullYear()) * 12 + (h.getMonth() - n.getMonth()) - (h.getDate() < n.getDate() ? 1 : 0);
}
