const normalizar = (valor: string) => valor.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const separar = (valor: string) => normalizar(valor).match(/[\p{L}]+|\d+(?:[.,]\d+)?/gu) ?? [];
const numero = (valor: string) => /^\d/.test(valor);
const valorNumerico = (valor: string) => Number(valor.replace(",", "."));

/** Termos combinados; números inteiros ou decimais não casam com prefixos de outros valores. */
export function criarFiltroMedicamentos(termo: string): (nome: string) => boolean {
  const termos = separar(termo);
  return nome => {
    const texto = normalizar(nome);
    const numeros = separar(nome).filter(numero).map(valorNumerico);
    return termos.every(t => numero(t) ? numeros.includes(valorNumerico(t)) : texto.includes(t));
  };
}
