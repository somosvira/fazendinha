import { useEffect, useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  Panel,
  Pill,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqSanidade } from "../sanidade/api";
import { obterReproducao, reqV4 } from "./api";
type Regra = {
  id: string;
  doencaId: string;
  acao: string;
  efeito: string;
  motivo: string;
  ativo: boolean;
  doenca?: { nome: string };
};
export function RegrasSanitarias({ podeEditar }: { podeEditar: boolean }) {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [doencas, setDoencas] = useState<
    Array<{ id: string; nome: string; ativo: boolean }>
  >([]);
  const [aberto, setAberto] = useState(false);
  const [doencaId, setDoencaId] = useState("");
  const [acao, setAcao] = useState("IA");
  const [efeito, setEfeito] = useState("ALERTAR");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = async () => {
    try {
      const [r, d] = await Promise.all([
        obterReproducao().then((p) => p.regrasSanitarias ?? []),
        reqSanidade<Array<{ id: string; nome: string; ativo: boolean }>>(
          "/doencas",
        ),
      ]);
      setRegras(r);
      setDoencas(d);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void carregar();
  }, []);
  return (
    <Panel>
      <CabecalhoTabela
        titulo="Restrições por doença"
        acao={
          podeEditar && (
            <Button secondary onClick={() => setAberto(true)}>
              Configurar regra
            </Button>
          )
        }
      />
      <div className="p-4 space-y-3">
        <ErrorBox erro={erro} />
        <p className="text-sm text-ink-3">
          As regras são definidas pela fazenda. Nenhum bloqueio clínico é
          presumido pelo sistema.
        </p>
        {regras.map((r) => (
          <div
            className="flex flex-wrap gap-3 text-sm border-t border-border pt-3"
            key={r.id}
          >
            <strong>
              {r.doenca?.nome ??
                doencas.find((d) => d.id === r.doencaId)?.nome ??
                "Doença"}
            </strong>
            <span>
              {r.acao} · {r.efeito === "BLOQUEAR" ? "Bloquear" : "Alertar"}
            </span>
            <span>{r.motivo}</span>
            <Pill>{r.ativo ? "Ativa" : "Inativa"}</Pill>
          </div>
        ))}
        {!regras.length && (
          <p className="text-sm">Nenhuma regra configurada.</p>
        )}
      </div>
      {aberto && (
        <PainelCadastro
          aberto
          titulo="Configurar restrição por doença"
          onFechar={() => setAberto(false)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button form="regra-reproducao" type="submit" disabled={ocupado}>
                Salvar regra
              </Button>
            </>
          }
        >
          <form
            id="regra-reproducao"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const propriedadeId = getPropriedadeAtiva();
              if (!propriedadeId) {
                setErro("Selecione um sítio.");
                return;
              }
              setOcupado(true);
              setErro(null);
              reqV4("/reproducao/regras-sanitarias", {
                propriedadeId,
                doencaId,
                acao,
                efeito,
                motivo,
                ativo: true,
              })
                .then(async () => {
                  setAberto(false);
                  await carregar();
                })
                .catch((e) => setErro(e.message))
                .finally(() => setOcupado(false));
            }}
          >
            <ErrorBox erro={erro} />
            <label>
              Doença
              <select
                className={classeInput}
                required
                value={doencaId}
                onChange={(e) => setDoencaId(e.target.value)}
              >
                <option value="">Selecione</option>
                {doencas
                  .filter((d) => d.ativo)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nome}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Ação
              <select
                className={classeInput}
                value={acao}
                onChange={(e) => setAcao(e.target.value)}
              >
                {["IA", "TE", "COBERTURA", "IATF"].map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <label>
              Efeito
              <select
                className={classeInput}
                value={efeito}
                onChange={(e) => setEfeito(e.target.value)}
              >
                <option value="ALERTAR">Alertar e exigir ciência</option>
                <option value="BLOQUEAR">Bloquear</option>
              </select>
            </label>
            <label>
              Motivo definido pela fazenda
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
      )}
    </Panel>
  );
}
