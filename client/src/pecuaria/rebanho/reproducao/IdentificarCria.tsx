import { useState } from "react";
import { Button, ErrorBox } from "../../../financeiro/financeiro-ui";
import {
  CampoFormulario,
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { reqV4 } from "./api";
export function IdentificarCria({
  animalId,
  propriedadeId,
  nomeInicial,
  onFechar,
  onSalvo,
}: {
  animalId: string;
  propriedadeId: number | null;
  nomeInicial?: string | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [brinco, setBrinco] = useState("");
  const [nome, setNome] = useState(nomeInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  return (
    <PainelCadastro
      aberto
      titulo="Completar identificação da cria"
      onFechar={onFechar}
      bloqueado={ocupado}
      rodape={
        <>
          <Button secondary disabled={ocupado} onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" form="identificar-cria" disabled={ocupado}>
            Salvar identificação
          </Button>
        </>
      }
    >
      <form
        id="identificar-cria"
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!propriedadeId) {
            setErro("Selecione o sítio atual da cria.");
            return;
          }
          setOcupado(true);
          setErro(null);
          reqV4(`/reproducao/crias/${animalId}/identificacao`, {
            propriedadeId,
            brinco,
            nome: nome || undefined,
          })
            .then(onSalvo)
            .catch((e) => setErro(e.message))
            .finally(() => setOcupado(false));
        }}
      >
        <ErrorBox erro={erro} />
        <p className="text-sm">
          O código provisório, a filiação e os fatos anteriores permanecem no
          histórico.
        </p>
        <CampoFormulario
          id="cria-brinco-definitivo"
          rotulo="Brinco definitivo"
          obrigatorio
        >
          {(p) => (
            <input
              {...p}
              className={classeInput}
              required
              maxLength={39}
              value={brinco}
              onChange={(e) => setBrinco(e.target.value)}
            />
          )}
        </CampoFormulario>
        <CampoFormulario id="cria-nome-definitivo" rotulo="Nome (opcional)">
          {(p) => (
            <input
              {...p}
              className={classeInput}
              maxLength={120}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          )}
        </CampoFormulario>
      </form>
    </PainelCadastro>
  );
}
