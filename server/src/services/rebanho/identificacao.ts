function nomeValido(nome?: string | null): string | null {
  const limpo = nome?.trim();
  return limpo || null;
}

export function rotuloAnimal(numero: string, nome?: string | null): string {
  const limpo = nomeValido(nome);
  return `#${numero}${limpo ? ` · ${limpo}` : ""}`;
}

export function mencaoAnimal(numero: string, nome?: string | null): string {
  const limpo = nomeValido(nome);
  return `#${numero}${limpo ? ` ${limpo}` : ""}`;
}
