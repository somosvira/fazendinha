import { CorrigirFato } from "./CorrigirFato";
import { FormLactacao } from "./FormLactacao";
import { useState } from "react";
import {
  Button,
  CabecalhoTabela,
  ErrorBox,
  hoje,
  Panel,
  Pill,
} from "../../../financeiro/financeiro-ui";
import {
  classeInput,
  PainelCadastro,
} from "../../../financeiro/PainelCadastro";
import { getPropriedadeAtiva } from "../../../propriedadeScope";
import { reqV4, type AnimalReprodutivo, type PainelReprodutivo } from "./api";
type Acao = {
  tipo:
    | "perda"
    | "restricao"
    | "lactacao"
    | "previsao"
    | "vinculo"
    | "identificacao";
  id: string;
  animalId: string;
  propriedadeId?: number | null;
};
export function AcoesReprodutivas({
  painel,
  animalId,
  podeLancar,
  onMudou,
  propriedadeId: propriedadeContexto,
}: {
  painel: PainelReprodutivo;
  animalId?: string;
  podeLancar: boolean;
  onMudou: () => Promise<void>;
  propriedadeId?: number;
}) {
  const [lactacaoCorrigida, setLactacaoCorrigida] = useState<
    NonNullable<PainelReprodutivo["lactacoes"]>[number] | null
  >(null);
  const [acao, setAcao] = useState<Acao | null>(null);
  const [historicoLactacao, setHistoricoLactacao] = useState<string | null>(null);
  const [previsao, setPrevisao] = useState("");
  const [tentativaId, setTentativaId] = useState("");
  const [brinco, setBrinco] = useState("");
  const [nomeCria, setNomeCria] = useState("");
  const [data, setData] = useState(hoje());
  const [motivo, setMotivo] = useState("");
  const [causaClinica,setCausaClinica]=useState("DESCONHECIDA");
  const [descricaoCausa,setDescricaoCausa]=useState("");
  const [evidenciasPerda, setEvidenciasPerda] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [chave, setChave] = useState(() => crypto.randomUUID());
  const abrir = (a: Acao) => {
    setChave(crypto.randomUUID());
    setAcao(a);
    setData(hoje());
    setMotivo("");
    setCausaClinica("DESCONHECIDA");setDescricaoCausa("");
    setEvidenciasPerda("");
    setPrevisao("");
    setTentativaId("");
    setBrinco("");
    setNomeCria("");
    setErro(null);
  };
  const nome = (id: string) =>
    painel.animais.find((a) => a.animalId === id)?.brinco ?? "Animal";
  return (
    <Panel>
      <CabecalhoTabela titulo="Gestação, restrições e lactação" />
      <div className="p-4 space-y-4">
        {painel.animais
          .filter((a) => !animalId || a.animalId === animalId)
          .map((a) => (
            <section className="text-sm space-y-2" key={a.animalId}>
              <h3 className="font-semibold">{a.brinco}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <span>{a.situacaoProdutiva === "LACTANTE" && a.del != null
                  ? `Em lactação · DEL ${a.del} (D0)`
                  : a.situacaoProdutiva === "SECA" ? "Seca"
                    : "Situação produtiva não informada"}</span>
                {a.diasPosParto != null && <span>{a.diasPosParto} dias após o último parto</span>}
                {podeLancar && <Button secondary onClick={() => setHistoricoLactacao(a.animalId)}>Informar lactação histórica</Button>}
              </div>
              {a.gestacao && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Gestação aberta · previsão{" "}
                    {a.gestacao.previsaoParto?.slice(0, 10) ?? "não informada"}
                  </span>
                  {podeLancar && (
                    <Button
                      secondary
                      onClick={() =>
                        abrir({
                          tipo: "perda",
                          id: a.gestacao!.id,
                          animalId: a.animalId,
                        })
                      }
                    >
                      Registrar perda
                    </Button>
                  )}
                  {podeLancar && (
                    <>
                      <Button
                        secondary
                        onClick={() =>
                          abrir({
                            tipo: "previsao",
                            id: a.gestacao!.id,
                            animalId: a.animalId,
                          })
                        }
                      >
                        Editar previsão
                      </Button>
                      <Button
                        secondary
                        onClick={() =>
                          abrir({
                            tipo: "vinculo",
                            id: a.gestacao!.id,
                            animalId: a.animalId,
                          })
                        }
                      >
                        Corrigir vínculo da tentativa
                      </Button>
                    </>
                  )}
                </div>
              )}
              {a.restricoes.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap justify-between items-center gap-3"
                >
                  <span>
                    <Pill>{r.tipo}</Pill> {r.motivo} ·{" "}
                    {r.acoes?.join(", ") ?? "Todas as intervenções"}
                  </span>
                  {podeLancar && (
                    <Button
                      secondary
                      onClick={() =>
                        abrir({
                          tipo: "restricao",
                          id: r.id,
                          animalId: a.animalId,
                          propriedadeId: r.propriedadeId,
                        })
                      }
                    >
                      Encerrar restrição
                    </Button>
                  )}
                </div>
              ))}
            </section>
          ))}
        {painel.gestacoes?.some(g => g.tipoEncerramento === "PERDA" && (!animalId || g.animalId === animalId)) && (
          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer font-semibold">Perdas gestacionais registradas</summary>
            {painel.gestacoes.filter(g => g.tipoEncerramento === "PERDA" && (!animalId || g.animalId === animalId)).map(g => (
              <article key={g.id} className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                <p>{g.animal?.brinco ?? g.animal?.nome ?? nome(g.animalId ?? "")} · {g.encerradaEm?.slice(0, 10).split("-").reverse().join("/")} · {g.status}</p>
                <p>{g.motivoEncerramento ?? "Explicação histórica não informada"}</p>
                <p>Causa clínica: {g.causaClinica ? { DESCONHECIDA: "Desconhecida", SUSPEITA: "Suspeita", CONFIRMADA: "Confirmada" }[g.causaClinica.estado] : "Não informada"}</p>
                {g.causaClinica?.descricao && <p>{g.causaClinica.descricao}</p>}
                {g.causaClinica?.evidencias?.length ? <ul className="list-disc pl-5">{g.causaClinica.evidencias.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p>Evidências não informadas.</p>}
              </article>
            ))}
          </details>
        )}
        {painel.lactacoes
          ?.filter((l) => !animalId || l.animalId === animalId)
          .map((l) => (
            <div
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"
            >
              <span>
                {nome(l.animalId)} · lactação desde {l.inicio.slice(0, 10)} ·{" "}
                {l.encerradaEm
                  ? `encerrada ${l.encerradaEm.slice(0, 10)}`
                  : "aberta"}
              </span>
              {podeLancar && (
                <Button secondary onClick={() => setLactacaoCorrigida(l)}>
                  Corrigir vínculo do parto
                </Button>
              )}
              {podeLancar && !l.encerradaEm && (
                <Button
                  secondary
                  onClick={() =>
                    abrir({
                      tipo: "lactacao",
                      id: l.id,
                      animalId: l.animalId,
                      propriedadeId: l.propriedadeId,
                    })
                  }
                >
                  Encerrar lactação
                </Button>
              )}
            </div>
          ))}
        {painel.partos
          .filter((p) => !animalId || p.animalId === animalId)
          .flatMap((p) =>
            (p.crias ?? [])
              .filter((c) => c.viva && c.animalId)
              .map((c) => (
                <div
                  key={c.animalId}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-sm"
                >
                  <span>
                    Cria de {nome(p.animalId)} ·{" "}
                    {c.animal?.brinco ?? c.brinco ?? "Cadastro provisório"}
                  </span>
                  {podeLancar &&
                    c.animal?.identificacaoProvisoria !== false && (
                      <Button
                        secondary
                        onClick={() =>
                          abrir({
                            tipo: "identificacao",
                            id: c.animalId!,
                            animalId: c.animalId!,
                          })
                        }
                      >
                        Completar identificação da cria
                      </Button>
                    )}
                </div>
              )),
          )}
      </div>
      {historicoLactacao && <FormLactacao animalId={historicoLactacao} partos={painel.partos} propriedadeId={propriedadeContexto}
        onFechar={() => setHistoricoLactacao(null)}
        onSalvo={() => { setHistoricoLactacao(null); void onMudou(); }} />}
      {lactacaoCorrigida && (
        <CorrigirFato
          tipo="lactacao"
          id={lactacaoCorrigida.id}
          animalId={lactacaoCorrigida.animalId}
          propriedadeId={lactacaoCorrigida.propriedadeId}
          partoInicial={lactacaoCorrigida.partoId}
          onFechar={() => setLactacaoCorrigida(null)}
          onSalvo={() => {
            setLactacaoCorrigida(null);
            void onMudou();
          }}
        />
      )}
      {acao && (
        <PainelCadastro
          aberto
          titulo={
            {
              perda: "Registrar perda gestacional",
              restricao: "Encerrar restrição",
              lactacao: "Encerrar lactação",
              previsao: "Editar previsão de parto",
              vinculo: "Corrigir vínculo da tentativa",
              identificacao: "Completar identificação da cria",
            }[acao.tipo]
          }
          onFechar={() => setAcao(null)}
          bloqueado={ocupado}
          rodape={
            <>
              <Button secondary onClick={() => setAcao(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="acao-reproducao" disabled={ocupado}>
                Confirmar
              </Button>
            </>
          }
        >
          <form
            id="acao-reproducao"
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              const propriedadeId = acao.propriedadeId ?? propriedadeContexto ?? getPropriedadeAtiva();
              if (!propriedadeId) {
                setErro("Selecione um sítio.");
                return;
              }
              setOcupado(true);
              setErro(null);
              const corpo =
                acao.tipo === "previsao"
                  ? {
                      propriedadeId,
                      previsaoParto: previsao || null,
                      motivo,
                      origem: "CORRECAO",
                    }
                  : acao.tipo === "vinculo"
                    ? {
                        propriedadeId,
                        tentativaId: tentativaId || null,
                        motivo,
                      }
                    : acao.tipo === "identificacao"
                      ? { propriedadeId, brinco, nome: nomeCria || undefined }
                      : acao.tipo === "perda"
                        ? {
                            chave,
                            propriedadeId,
                            animalId: acao.animalId,
                            gestacaoId: acao.id,
                            causaClinica: {estado:causaClinica,...(descricaoCausa.trim()?{descricao:descricaoCausa.trim()}: {}),
                              evidencias: evidenciasPerda.split("\n").map(e => e.trim()).filter(Boolean)},
                            data,
                            motivo,
                          }
                        : { propriedadeId, data, motivo };
              const path =
                acao.tipo === "previsao" || acao.tipo === "vinculo"
                  ? `/reproducao/gestacoes/${acao.id}/${acao.tipo === "previsao" ? "previsao" : "vinculo"}`
                  : acao.tipo === "identificacao"
                    ? `/reproducao/crias/${acao.id}/identificacao`
                    : acao.tipo === "perda"
                      ? "/reproducao/perdas"
                      : `/reproducao/${acao.tipo === "restricao" ? "restricoes" : "lactacoes"}/${acao.id}/encerramento`;
              reqV4(path, corpo)
                .then(async () => {
                  setAcao(null);
                  await onMudou();
                })
                .catch((e) => setErro(e.message))
                .finally(() => setOcupado(false));
            }}
          >
            {acao.tipo==="perda"&&<><p className="text-sm">Descreva a observação e o contexto da perda no motivo obrigatório. A causa clínica pode permanecer desconhecida.</p><label>Causa clínica<select className={classeInput} value={causaClinica} onChange={e=>setCausaClinica(e.target.value)}><option value="DESCONHECIDA">Desconhecida</option><option value="SUSPEITA">Suspeita</option><option value="CONFIRMADA">Confirmada</option></select></label><label>Descrição da causa (quando conhecida)<textarea className={classeInput} value={descricaoCausa} required={causaClinica!=="DESCONHECIDA"} minLength={2} maxLength={1000} onChange={e=>setDescricaoCausa(e.target.value)}/></label><label>Evidências e referências (opcional, uma por linha)<textarea className={classeInput} rows={3} value={evidenciasPerda} onChange={e=>setEvidenciasPerda(e.target.value)} aria-describedby="evidencias-perda-ajuda"/></label><p id="evidencias-perda-ajuda" className="text-sm text-ink-3">Informe referências de exames, laudos ou observações de campo. Até 20 referências, com 2 a 1.000 caracteres cada.</p></>}
            <ErrorBox erro={erro} />
            <p className="text-sm">
              Animal {nome(acao.animalId)}. O histórico e os fatos anteriores
              serão preservados.
            </p>
            {["perda", "restricao", "lactacao"].includes(acao.tipo) && (
              <label>
                Data
                <input
                  type="date"
                  required
                  className={classeInput}
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                />
              </label>
            )}
            {acao.tipo === "previsao" && (
              <label>
                Previsão (vazio remove a previsão)
                <input
                  type="date"
                  className={classeInput}
                  value={previsao}
                  onChange={(e) => setPrevisao(e.target.value)}
                />
              </label>
            )}
            {acao.tipo === "vinculo" && (
              <label>
                Tentativa comprovada
                <select
                  className={classeInput}
                  value={tentativaId}
                  onChange={(e) => setTentativaId(e.target.value)}
                >
                  <option value="">Vínculo desconhecido</option>
                  {painel.tentativas
                    .filter(
                      (t) =>
                        t.animalId === acao.animalId && t.status !== "ANULADO",
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.data.slice(0, 10)} · {t.tipo}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {acao.tipo === "identificacao" ? (
              <>
                <label>
                  Brinco definitivo
                  <input
                    className={classeInput}
                    required
                    maxLength={39}
                    value={brinco}
                    onChange={(e) => setBrinco(e.target.value)}
                  />
                </label>
                <label>
                  Nome (opcional)
                  <input
                    className={classeInput}
                    maxLength={120}
                    value={nomeCria}
                    onChange={(e) => setNomeCria(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <label>
                Motivo
                <textarea
                  required
                  minLength={5}
                  className={classeInput}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </label>
            )}
          </form>
        </PainelCadastro>
      )}
    </Panel>
  );
}
