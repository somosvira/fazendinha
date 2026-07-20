// Cálculo puro do diff de alocação de um animal — decide quais movimentações (GRUPO/SETOR)
// registrar quando o cadastro do animal muda de lote/setor. Sem I/O: recebe o estado atual e a
// edição, devolve os fatos a gravar. Só gera fato quando o valor MUDA (undefined = "não mexe").

export type TipoMovimentacao = "GRUPO" | "SETOR";

export interface EstadoAlocacao {
  grupoId: number | null;
  grupoNome: string | null;
  setor: string | null;
}

// A edição do animal: cada campo é opcional. `undefined` = não mexe nesse campo;
// valor (inclusive null) = definir. `grupoNome` acompanha `grupoId` (rótulo do destino).
export interface EdicaoAlocacao {
  grupoId?: number | null;
  grupoNome?: string | null;
  setor?: string | null;
}

// Um fato de movimentação pronto para gravar (sem data/animalId — o service os injeta).
export interface MovimentacaoFato {
  tipo: TipoMovimentacao;
  origem: string | null;
  destino: string;
  grupoOrigemId?: number | null;
  grupoDestinoId?: number | null;
}

const VAZIO = "—"; // rótulo de destino quando o animal sai de um grupo/setor para nenhum

export function diffMovimentacoes(atual: EstadoAlocacao, edicao: EdicaoAlocacao): MovimentacaoFato[] {
  const movs: MovimentacaoFato[] = [];

  // GRUPO: só quando grupoId veio na edição (undefined = não mexe) e mudou de fato.
  if (edicao.grupoId !== undefined && edicao.grupoId !== atual.grupoId) {
    movs.push({
      tipo: "GRUPO",
      origem: atual.grupoNome,
      destino: edicao.grupoNome ?? VAZIO,
      grupoOrigemId: atual.grupoId,
      grupoDestinoId: edicao.grupoId,
    });
  }

  // SETOR: só quando setor veio na edição e mudou de fato.
  if (edicao.setor !== undefined && edicao.setor !== atual.setor) {
    movs.push({ tipo: "SETOR", origem: atual.setor, destino: edicao.setor ?? VAZIO });
  }

  return movs;
}
