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

/**
 * Valida a edição dos campos fixos de um animal (sexo, nascimento, origem, entrada,
 * partos antes da entrada) contra o histórico já registrado: a entrada não pode ficar
 * depois do início da primeira localização/destino, o nascimento não pode ficar depois
 * da primeira pesagem, a entrada não pode ficar depois da primeira saída, e um animal
 * NASCIDO sempre tem entrada === nascimento.
 */
export function validarEdicaoAnimal(input: {
  sexo: "F" | "M";
  dataNascimento: Date | string;
  origem: "NASCIDO" | "COMPRADO";
  dataEntrada: Date | string;
  partosAntesDaEntrada: number;
  primeiraLocalizacaoDesde: Date | string | null;
  primeiroDestinoDesde: Date | string | null;
  primeiraPesagemData: Date | string | null;
  primeiraSaidaData: Date | string | null;
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (antes(input.dataEntrada, input.dataNascimento)) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser anterior à data de nascimento" });
  }

  if (input.origem === "NASCIDO" && diferente(input.dataEntrada, input.dataNascimento)) {
    erros.push({ campo: "dataEntrada", mensagem: "Animal nascido na propriedade deve ter data de entrada igual à de nascimento" });
  }

  if (input.primeiraLocalizacaoDesde != null && antes(input.primeiraLocalizacaoDesde, input.dataEntrada)) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser posterior ao início da primeira localização registrada" });
  }

  if (input.primeiroDestinoDesde != null && antes(input.primeiroDestinoDesde, input.dataEntrada)) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser posterior ao início do primeiro destino registrado" });
  }

  if (input.primeiraPesagemData != null && antes(input.primeiraPesagemData, input.dataNascimento)) {
    erros.push({ campo: "dataNascimento", mensagem: "Data de nascimento não pode ser posterior à primeira pesagem registrada" });
  }

  if (input.primeiraSaidaData != null && antes(input.primeiraSaidaData, input.dataEntrada)) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser posterior à saída do animal" });
  }

  return erros;
}
