export function documentoFiscalValido(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  if (![11, 14].includes(digitos.length) || /^(\d)\1+$/.test(digitos)) return false;

  const calcularDigito = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((total, digito, indice) => total + Number(digito) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (digitos.length === 11) {
    const primeiro = calcularDigito(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
    const segundo = calcularDigito(`${digitos.slice(0, 9)}${primeiro}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
    return digitos.endsWith(`${primeiro}${segundo}`);
  }

  const primeiro = calcularDigito(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = calcularDigito(`${digitos.slice(0, 12)}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digitos.endsWith(`${primeiro}${segundo}`);
}

export function emailValido(valor: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}
