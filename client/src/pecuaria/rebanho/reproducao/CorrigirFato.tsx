import { useEffect, useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { obterReproducao, reqV4, type PainelReprodutivo } from "./api";
export function CorrigirFato({
  tipo,
  id,
  animalId,
  propriedadeId,
  gestacaoInicial,
  partoInicial,
  tipoPartoInicial,
  onFechar,
  onSalvo,
}: {
  tipo: "parto" | "lactacao";
  id: string;
  animalId: string;
  propriedadeId?: number | null;
  gestacaoInicial?: string | null;
  partoInicial?: string | null;
  tipoPartoInicial?: string;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [painel, setPainel] = useState<PainelReprodutivo | null>(null);
  const [vinculo, setVinculo] = useState(
    (tipo === "parto" ? gestacaoInicial : partoInicial) ?? "",
  );
  const [tipoParto, setTipoParto] = useState(tipoPartoInicial ?? "NORMAL");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    obterReproducao(animalId)
      .then(setPainel)
      .catch((e) => setErro(e.message));
  }, [animalId]);
  return (
    <PainelCadastro
      aberto
      titulo={
        tipo === "parto"
          ? "Corrigir registro de parto"
          : "Corrigir vínculo da lactação"
      }
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="corrigir-fato-v4"
            disabled={ocupado || !painel}
          >
            Salvar correção
          </Button>
        </>
      }
    >
      <form
        id="corrigir-fato-v4"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const prop = propriedadeId ?? getPropriedadeAtiva();
          if (!prop) {
            setErro("Selecione o sítio do fato.");
            return;
          }
          setOcupado(true);
          setErro(null);
          reqV4(
            `/reproducao/${tipo === "parto" ? "partos" : "lactacoes"}/${id}/correcao`,
            tipo === "parto"
              ? {
                  propriedadeId: prop,
                  tipo: tipoParto,
                  gestacaoId: vinculo || null,
                  motivo,
                }
              : { propriedadeId: prop, partoId: vinculo || null, motivo },
          )
            .then(onSalvo)
            .catch((e) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        <ErrorBox erro={erro} />
        <p className="text-sm">
          A correção conserva os fatos anteriores, os cadastros e a filiação das
          crias. Desvincular a lactação preserva o período físico registrado.
        </p>
        {tipo === "parto" && (
          <label>
            Tipo de parto
            <select
              className={classeInput}
              value={tipoParto}
              onChange={(e) => setTipoParto(e.target.value)}
            >
              {[
                ["NORMAL", "Normal"],
                ["DISTOCICO", "Distócico"],
                ["ABORTO", "Aborto"],
                ["NATIMORTO", "Natimorto"],
              ].map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {tipo === "parto" ? "Gestação vinculada" : "Parto vinculado"}
          <select
            className={classeInput}
            value={vinculo}
            onChange={(e) => setVinculo(e.target.value)}
          >
            <option value="">Sem vínculo · desvincular</option>
            {tipo === "parto"
              ? (painel?.gestacoes ?? [])
                  .filter((g) => g.status === "VALIDO")
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      Gestação confirmada em{" "}
                      {g.confirmadaEm?.slice(0, 10) ?? g.id.slice(0, 8)}
                    </option>
                  ))
              : (painel?.partos ?? [])
                  .filter((p) => p.status !== "ANULADO")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.data.slice(0, 10)} · {p.tipo}
                    </option>
                  ))}
          </select>
        </label>
        <label>
          Motivo da correção
          <textarea
            className={classeInput}
            required
            minLength={5}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </label>
      </form>
    </PainelCadastro>
  );
}
