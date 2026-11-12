import { useEffect, useState } from "react";
import { ErrorBox } from "../../../financeiro/financeiro-ui";
import type { TipoExame } from "../sanidade/CadastrosSanitarios";
import {
  listarDemandasAcompanhamento,
  type DemandaAcompanhamento,
} from "./acompanhamento-api";
import {
  AvaliacaoContextualCampos,
  type DadosFormularioContextual,
} from "./AvaliacaoContextualCampos";
import { contextoAvaliacao } from "./avaliacao-contextual-api";
import type { ParticipanteVisita, RascunhoVisita } from "./visitas-api";

/** Mantém o JSON salvo equivalente ao payload clínico da conferência. Zero e falso permanecem. */
export function limparCamposContextuais(dados: RascunhoVisita): RascunhoVisita {
  const limpo = { ...dados };
  for (const campo of [
    "resultado",
    "finalidade",
    "sexoFetal",
    "tipoExameId",
    "formatoExameHash",
    "tentativaId",
    "gestacaoId",
    "motivoVinculoDesconhecido",
    "conduta",
    "decisaoIatf",
    "motivo",
    "retornoEm",
    "retornoAptidaoEm",
  ] as const) {
    if (limpo[campo] === "" || limpo[campo] === undefined) delete limpo[campo];
  }
  delete limpo.revisaoContextual;
  return limpo;
}

export function AvaliacaoContextualVisita({
  participante,
  propriedadeId,
  dados,
  tiposExame,
  onChange,
  disabled,
}: {
  participante: ParticipanteVisita;
  propriedadeId: number;
  dados: RascunhoVisita;
  tiposExame: TipoExame[];
  onChange: (patch: Partial<RascunhoVisita>) => void;
  disabled: boolean;
}) {
  const [necessidades, setNecessidades] = useState<DemandaAcompanhamento[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    setErro(null);
    setNecessidades([]);
    void (async () => {
      try {
        const pagina = await listarDemandasAcompanhamento(
          propriedadeId,
          participante.animalId,
          1,
          "PENDENTE",
        );
        const itens = [...pagina.itens];
        for (
          let p = 2;
          ativo && p <= Math.ceil(pagina.total / pagina.porPagina);
          p++
        )
          itens.push(
            ...(
              await listarDemandasAcompanhamento(
                propriedadeId,
                participante.animalId,
                p,
                "PENDENTE",
              )
            ).itens,
          );
        if (ativo) setNecessidades(itens);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      ativo = false;
    };
  }, [propriedadeId, participante.animalId]);
  const contexto = participante.snapshot;
  const tipo = tiposExame.find((t) => t.id === dados.tipoExameId);
  function mudar(patch: Partial<DadosFormularioContextual>) {
    const { revisaoContextual: _revisao, sexoFetal, ...resto } = patch;
    onChange({
      ...resto,
      ...(patch.avaliacaoContextual && !dados.avaliacaoContextual
        ? { conduta: undefined, decisaoIatf: undefined, retornoEm: undefined }
        : {}),
      ...(sexoFetal !== undefined ? { sexoFetal: sexoFetal ?? "" } : {}),
      status: "CONFIRMADO",
    });
  }
  return (
    <div className="grid gap-3 lg:col-span-2">
      <AvaliacaoContextualCampos
        propriedadeId={propriedadeId}
        contexto={contextoAvaliacao({
          gestacaoId: dados.gestacaoId || contexto.gestacao?.id,
          tentativaId:
            dados.tentativaId ||
            contexto.ultimaTentativa?.id ||
            contexto.tentativa?.id,
          partos: contexto.partos,
        })}
        dados={dados}
        campos={tipo?.campos ?? []}
        necessidades={necessidades.filter(
          (n) =>
            n.id === contexto.acompanhamento?.id ||
            (!!dados.tentativaId && n.tentativaId === dados.tentativaId) ||
            (!!dados.gestacaoId && n.gestacaoId === dados.gestacaoId),
        )}
        onChange={mudar}
        onTipoExame={(id) => {
          const escolhido = tiposExame.find((t) => t.id === id && t.ativo);
          if (!escolhido?.formatoExameHash)
            throw new Error(
              "O tipo de exame do catálogo não está disponível nesta visita. Atualize os tipos e confira novamente.",
            );
          onChange({
            tipoExameId: id,
            formatoExameHash: escolhido.formatoExameHash,
            status: "CONFIRMADO",
          });
        }}
        disabled={disabled}
        identificacao={contexto.brinco ?? String(participante.ordem)}
      />
      {dados.avaliacaoContextual && erro && (
        <ErrorBox
          erro={`Não foi possível consultar os cuidados existentes: ${erro}`}
        />
      )}
    </div>
  );
}
