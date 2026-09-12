/* Validação síncrona dos cadastros financeiros (conta e parceiro).
 * Puro, sem React — testado em validacao.test.ts. As mensagens são as que a
 * UI exibe junto ao campo. */

export const somenteDigitos = (valor: string) => valor.replace(/\D/g, "");

const repetido = (d: string) => /^(\d)\1+$/.test(d);

function digitoVerificador(base: string, pesos: number[]) {
  const soma = base.split("").reduce((acc, ch, i) => acc + Number(ch) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function validarCpf(digitos: string): boolean {
  if (digitos.length !== 11 || repetido(digitos)) return false;
  const d1 = digitoVerificador(digitos.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(digitos.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digitos[9]) && d2 === Number(digitos[10]);
}

export function validarCnpj(digitos: string): boolean {
  if (digitos.length !== 14 || repetido(digitos)) return false;
  const d1 = digitoVerificador(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digitoVerificador(digitos.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d1 === Number(digitos[12]) && d2 === Number(digitos[13]);
}

/** Mensagem de erro ou null. Vazio é válido (documento é opcional). */
export function validarDocumento(valor: string): string | null {
  const d = somenteDigitos(valor);
  if (!d) return null;
  if (d.length === 11) return validarCpf(d) ? null : "CPF inválido";
  if (d.length === 14) return validarCnpj(d) ? null : "CNPJ inválido";
  return "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos)";
}

export function formatarDocumento(valor: string | null | undefined): string {
  if (!valor) return "";
  const d = somenteDigitos(valor);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return valor;
}

export function validarEmail(valor: string): string | null {
  const v = valor.trim();
  if (!v) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "E-mail inválido";
}

export type ErrosCampo = Record<string, string>;

export type FormularioConta = {
  nome: string;
  saldoAbertura: string;
  dataSaldoAbertura: string;
  tipo?: "BANCO" | "CAIXA" | "APLICACAO";
  instituicao?: string;
  agencia?: string;
  numeroConta?: string;
  titular?: string;
};
export type FormularioParceiro = { nome: string; documento: string; email: string };

export function validarConta(form: FormularioConta, opcoes: { aberturaEditavel: boolean }): ErrosCampo {
  const erros: ErrosCampo = {};
  if (form.nome.trim().length < 2) erros.nome = "Informe um nome com pelo menos 2 caracteres";
  if (opcoes.aberturaEditavel) {
    const saldo = Number(form.saldoAbertura.replace(",", "."));
    if (form.saldoAbertura.trim() === "" || !Number.isFinite(saldo)) erros.saldoAbertura = "Informe um valor em reais";
    else if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(form.saldoAbertura.trim())) erros.saldoAbertura = "Use no máximo 2 casas decimais";
    if (!form.dataSaldoAbertura) erros.dataSaldoAbertura = "Informe a data do saldo de abertura";
  }
  if (form.tipo && form.tipo !== "CAIXA" && !form.instituicao?.trim()) erros.instituicao = "Informe a instituição financeira";
  if (form.tipo === "BANCO") {
    if (!form.agencia?.trim()) erros.agencia = "Informe a agência";
    if (!form.numeroConta?.trim()) erros.numeroConta = "Informe o número da conta";
    if (!form.titular?.trim()) erros.titular = "Informe o titular";
    else if (/\d/.test(form.titular)) erros.titular = "O titular não pode conter números";
  }
  return erros;
}

export function valorMonetario(valor: string): number {
  return Number(valor.replace(",", "."));
}

export function formatarValorMonetario(valor: string): string {
  const numero = valorMonetario(valor);
  return Number.isFinite(numero) ? numero.toFixed(2).replace(".", ",") : valor;
}

export function validarParceiro(form: FormularioParceiro): ErrosCampo {
  const erros: ErrosCampo = {};
  if (form.nome.trim().length < 2) erros.nome = "Informe um nome com pelo menos 2 caracteres";
  const doc = validarDocumento(form.documento); if (doc) erros.documento = doc;
  const email = validarEmail(form.email); if (email) erros.email = email;
  return erros;
}
