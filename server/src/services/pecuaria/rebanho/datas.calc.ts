// Validações puras de invariantes de data do domínio Rebanho.

export interface ErroValidacao {
  campo: string;
  mensagem: string;
}

function paraData(valor: Date | string): Date {
  return typeof valor === "string" ? new Date(valor) : valor;
}

function antes(a: Date | string, b: Date | string): boolean {
  return paraData(a).getTime() < paraData(b).getTime();
}

function diferente(a: Date | string, b: Date | string): boolean {
  return paraData(a).getTime() !== paraData(b).getTime();
}

export function validarDatasAnimal(input: {
  dataNascimento: Date | string;
  dataEntrada: Date | string;
  origem: "NASCIDO" | "COMPRADO";
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (antes(input.dataEntrada, input.dataNascimento)) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser anterior à data de nascimento" });
  }

  if (input.origem === "NASCIDO" && diferente(input.dataEntrada, input.dataNascimento)) {
    erros.push({ campo: "dataEntrada", mensagem: "Animal nascido na propriedade deve ter data de entrada igual à de nascimento" });
  }

  return erros;
}

export function validarDataSaida(input: {
  dataEntrada: Date | string;
  dataSaida: Date | string;
}): ErroValidacao[] {
  if (antes(input.dataSaida, input.dataEntrada)) {
    return [{ campo: "dataSaida", mensagem: "Data de saída não pode ser anterior à data de entrada" }];
  }
  return [];
}

export function validarDataPesagem(input: {
  dataNascimento: Date | string;
  dataSaida?: Date | string | null;
  dataPesagem: Date | string;
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (antes(input.dataPesagem, input.dataNascimento)) {
    erros.push({ campo: "dataPesagem", mensagem: "Data da pesagem não pode ser anterior ao nascimento" });
  }

  if (input.dataSaida != null && antes(input.dataSaida, input.dataPesagem)) {
    erros.push({ campo: "dataPesagem", mensagem: "Data da pesagem não pode ser posterior à saída do animal" });
  }

  return erros;
}

export function validarDataLocalizacao(input: {
  dataEntrada: Date | string;
  dataSaida?: Date | string | null;
  desde: Date | string;
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (antes(input.desde, input.dataEntrada)) {
    erros.push({ campo: "desde", mensagem: "Localização não pode começar antes da entrada do animal" });
  }

  if (input.dataSaida != null && antes(input.dataSaida, input.desde)) {
    erros.push({ campo: "desde", mensagem: "Localização não pode começar depois da saída do animal" });
  }

  return erros;
}

export function validarDataDestino(input: {
  dataEntrada: Date | string;
  desde: Date | string;
}): ErroValidacao[] {
  if (antes(input.desde, input.dataEntrada)) {
    return [{ campo: "data", mensagem: "Mudança de destino não pode ser anterior à entrada do animal" }];
  }
  return [];
}
