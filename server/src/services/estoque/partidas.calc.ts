export function nomeLotePadrao(produto: string, validade: Date | null) {
  const data = validade?.toISOString().slice(0, 10).split("-").reverse().join("/");
  return `${produto} — ${data ? `validade ${data}` : "validade não informada"}`;
}

export function validadeVencida(validade: Date, data: Date) {
  return validade.toISOString().slice(0, 10) < data.toISOString().slice(0, 10);
}
