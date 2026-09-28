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

/** dd/mm/aaaa, para mensagens de erro (as datas do domínio são `@db.Date`, sem hora/fuso). */
function formatarDataBR(valor: Date | string): string {
  const d = paraData(valor);
  const dia = String(d.getUTCDate()).padStart(2, "0");
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
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

export function validarDataBaixa(input: {
  dataEntrada: Date | string;
  dataBaixa: Date | string;
  /** última pesagem já registrada do animal (R2): a baixa não pode voltar no tempo antes dela */
  ultimaPesagemData?: Date | string | null;
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];
  if (antes(input.dataBaixa, input.dataEntrada)) {
    erros.push({ campo: "data", mensagem: "Data da baixa não pode ser anterior à data de entrada" });
  }
  if (input.ultimaPesagemData != null && antes(input.dataBaixa, input.ultimaPesagemData)) {
    erros.push({ campo: "data", mensagem: `A baixa não pode ser anterior à última pesagem (${formatarDataBR(input.ultimaPesagemData)})` });
  }
  return erros;
}

export function validarDataPesagem(input: {
  dataNascimento: Date | string;
  dataBaixa?: Date | string | null;
  dataPesagem: Date | string;
}): ErroValidacao[] {
  const erros: ErroValidacao[] = [];

  if (antes(input.dataPesagem, input.dataNascimento)) {
    erros.push({ campo: "data", mensagem: "Data da pesagem não pode ser anterior ao nascimento" });
  }

  if (input.dataBaixa != null && antes(input.dataBaixa, input.dataPesagem)) {
    erros.push({ campo: "data", mensagem: "Data da pesagem não pode ser posterior à baixa do animal" });
  }

  return erros;
}

export function validarDataDestino(input: {
  dataEntrada: Date | string;
  desde: Date | string;
}): ErroValidacao[] {
  if (antes(input.desde, input.dataEntrada)) {
    return [{ campo: "data", mensagem: "Mudança de finalidade não pode ser anterior à entrada do animal" }];
  }
  return [];
}

// ---------- ajuste do histórico inicial quando a data de entrada (ou o nascimento) muda ----------

export interface LinhaInicio {
  id: string;
  desde: Date | string;
  ate: Date | string | null;
}

export interface PesagemData {
  id: string;
  data: Date | string;
  tipo: string;
}

export interface PlanoAjusteEntrada {
  erros: ErroValidacao[];
  /** ids das linhas/pesagens que acompanham a nova data */
  moverLocalizacao: string | null;
  moverDestino: string | null;
  moverPesagensEntrada: string[];
  moverPesagensNascimento: string[];
}

/**
 * Quem começa exatamente na entrada antiga acompanha a nova: a 1ª localização, o 1º destino e a
 * pesagem ENTRADA; a pesagem NASCIMENTO acompanha o nascimento. A validação é feita contra o
 * histórico já ajustado — a nova entrada não pode passar do fim da 1ª linha, de outra pesagem,
 * nem da baixa.
 */
export function planejarAjusteEntrada(input: {
  entradaAntiga: Date | string;
  entradaNova: Date | string;
  nascimentoAntigo: Date | string;
  nascimentoNovo: Date | string;
  localizacoes: LinhaInicio[];
  destinos: LinhaInicio[];
  pesagens: PesagemData[];
  primeiraBaixaData: Date | string | null;
  /** `desde` da 1ª troca de categoria manual já registrada (R4): a entrada não pode passar dela */
  primeiraCategoriaManualDesde?: Date | string | null;
}): PlanoAjusteEntrada {
  const t = (v: Date | string) => paraData(v).getTime();
  const primeira = (linhas: LinhaInicio[]) => [...linhas].sort((a, b) => t(a.desde) - t(b.desde))[0] ?? null;
  const erros: ErroValidacao[] = [];
  const entradaNova = t(input.entradaNova);

  const ajustarLinha = (linha: LinhaInicio | null, rotulo: string): string | null => {
    if (!linha) return null;
    const acompanha = t(linha.desde) === t(input.entradaAntiga);
    const inicio = acompanha ? entradaNova : t(linha.desde);
    if (inicio < entradaNova) {
      erros.push({ campo: "dataEntrada", mensagem: `Data de entrada não pode ser posterior ao início da primeira ${rotulo} registrada` });
    }
    if (linha.ate != null && t(linha.ate) < inicio) {
      erros.push({ campo: "dataEntrada", mensagem: `Data de entrada não pode ser posterior ao fim da primeira ${rotulo} registrada` });
    }
    return acompanha && t(linha.desde) !== entradaNova ? linha.id : null;
  };

  const moverLocalizacao = ajustarLinha(primeira(input.localizacoes), "localização");
  const moverDestino = ajustarLinha(primeira(input.destinos), "destinação");

  const moverPesagensEntrada: string[] = [];
  const moverPesagensNascimento: string[] = [];
  for (const pesagem of input.pesagens) {
    let data = t(pesagem.data);
    if (pesagem.tipo === "ENTRADA" && data === t(input.entradaAntiga) && data !== entradaNova) {
      moverPesagensEntrada.push(pesagem.id);
      data = entradaNova;
    } else if (pesagem.tipo === "NASCIMENTO" && data === t(input.nascimentoAntigo) && data !== t(input.nascimentoNovo)) {
      moverPesagensNascimento.push(pesagem.id);
      data = t(input.nascimentoNovo);
    }
    if (data < t(input.nascimentoNovo)) {
      erros.push({ campo: "dataNascimento", mensagem: "Data de nascimento não pode ser posterior a uma pesagem registrada" });
    }
  }

  if (input.primeiraBaixaData != null && t(input.primeiraBaixaData) < entradaNova) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser posterior à baixa do animal" });
  }

  if (input.primeiraCategoriaManualDesde != null && t(input.primeiraCategoriaManualDesde) < entradaNova) {
    erros.push({ campo: "dataEntrada", mensagem: "Data de entrada não pode ser posterior a uma categoria manual já registrada" });
  }

  const unicos = erros.filter((e, i) => erros.findIndex((x) => x.mensagem === e.mensagem) === i);
  return { erros: unicos, moverLocalizacao, moverDestino, moverPesagensEntrada, moverPesagensNascimento };
}
