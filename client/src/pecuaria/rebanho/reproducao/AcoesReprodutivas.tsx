import { FormEncerrarLactacao } from "./FormEncerrarLactacao";
import { FormPesoSecagem } from "./FormPesoSecagem";
import { PesoSecagemLactacao } from "./PesoSecagemLactacao";
import { rotuloLactacao } from "../lib/lactacao";
import { CorrigirFato } from "./CorrigirFato";
import { FormLactacao } from "./FormLactacao";
import { useState } from "react";
import { Baby, CalendarDays, Clock, HeartPulse, Milk, Syringe } from "lucide-react";
import { formatBRDateISO } from "../../../lib/hoje";
import { DadoFicha } from "../ui";
import { SecaoGeralAnimal } from "../components/SecaoGeralAnimal";
import { MenuAcoesFicha } from "../components/MenuAcoesFicha";
import { SecaoReproducaoAnimal } from "./SecaoReproducaoAnimal";
import { rotulosReprodutivos } from "./HistoricoReprodutivo";
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
import { reqV4, type LactacaoReprodutiva, type AnimalReprodutivo, type PainelReprodutivo } from "./api";
type Acao = {
  tipo:
    | "perda"
    | "restricao"
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
  modo,
}: {
  painel: PainelReprodutivo;
  animalId?: string;
  podeLancar: boolean;
  onMudou: () => Promise<void>;
  propriedadeId?: number;
  modo?: "gestacao" | "restricoes" | "lactacao" | "crias";
}) {
  const [lactacaoEncerrando, setLactacaoEncerrando] = useState<LactacaoReprodutiva | null>(null);
  const [pesoSecagemMantido, setPesoSecagemMantido] = useState<LactacaoReprodutiva | null>(null);
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
  const animal = painel.animais.find(a => a.animalId === animalId);
  const gestacao = painel.gestacoes?.find(g => (animal?.gestacao ? g.id === animal.gestacao.id : g.animalId === animalId && g.status === "VALIDO" && !g.encerradaEm)) ?? animal?.gestacao;
  const tentativa = gestacao?.tentativaId ? painel.tentativas.find(t => t.id === gestacao.tentativaId) : null;
  const avaliacao = gestacao ? painel.avaliacoes.filter(a => a.animalId === animalId && a.status !== "ANULADO" && a.gestacaoId === gestacao.id).sort((a, b) => b.data.localeCompare(a.data))[0] : null;
  const lactacoes = (painel.lactacoes ?? []).filter(l => l.animalId === animalId).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const lactacaoAtual = lactacoes.find(l => !l.encerradaEm);
  const restricoes = animal?.restricoes ?? [];
  const abrirGestacao = (tipo: "previsao" | "vinculo" | "perda") => {
    if (gestacao && animalId) abrir({ tipo, id: gestacao.id, animalId, propriedadeId: gestacao.propriedadeId });
  };
  const crias = painel.partos.filter(p => p.animalId === animalId && p.status !== "ANULADO").flatMap(p => (p.crias ?? []).filter(c => c.viva && c.animalId && c.animal?.identificacaoProvisoria !== false));
  return <>
    {modo === "gestacao" ? <>{gestacao && !gestacao.encerradaEm && gestacao.status !== "ANULADO" && <SecaoReproducaoAnimal titulo="Gestação atual" icon={Baby} acao={podeLancar && gestacao ? <MenuAcoesFicha rotulo="Gerenciar gestação" itens={[
      { id: "previsao", rotulo: "Editar previsão", onSelect: () => abrirGestacao("previsao") },
      { id: "vinculo", rotulo: "Corrigir vínculo da tentativa", onSelect: () => abrirGestacao("vinculo") },
      { id: "perda", rotulo: "Registrar perda", onSelect: () => abrirGestacao("perda") },
    ]}/> : undefined}>
      {gestacao ? <dl className="repro-dados repro-dados-quatro">
        <DadoFicha icon={CalendarDays} rotulo="Confirmação">{gestacao.confirmadaEm ? formatBRDateISO(gestacao.confirmadaEm) : "Não informada"}</DadoFicha>
        <DadoFicha icon={Baby} rotulo="Previsão de parto">{gestacao.previsaoParto ? formatBRDateISO(gestacao.previsaoParto) : "Não informada"}</DadoFicha>
        <DadoFicha icon={Syringe} rotulo="Tentativa vinculada">{tentativa ? `${rotulosReprodutivos[tentativa.tipo ?? ""] ?? tentativa.tipo} · ${formatBRDateISO(tentativa.data)}` : gestacao.tentativaId ? "Vínculo fora deste histórico" : "Não informada"}</DadoFicha>
        <DadoFicha icon={HeartPulse} rotulo="Última avaliação">{avaliacao ? `${rotulosReprodutivos[avaliacao.tipo ?? ""] ?? "Avaliação"} · ${formatBRDateISO(avaliacao.data)}` : "Não informada"}</DadoFicha>
      </dl> : <p className="repro-vazio"><Baby aria-hidden="true"/>{animal?.situacao === "VAZIA" ? "Animal vazio · sem gestação em andamento" : "Situação gestacional não informada"}</p>}
    </SecaoReproducaoAnimal>}<PerdasGestacionais painel={painel} animalId={animalId} naFicha/></> : modo === "restricoes" ? <div className="repro-restricoes">
      {restricoes.length ? restricoes.map(r => <article key={r.id} className="repro-restricao"><div><strong>{rotulosReprodutivos[r.tipo] ?? r.tipo}</strong><p>{r.motivo}</p><small>{r.data ? `Desde ${formatBRDateISO(r.data)}` : "Início não informado"}{r.ate ? ` · Até ${formatBRDateISO(r.ate)}` : ""} · {r.acoes?.join(", ") ?? "Todas as intervenções"}</small></div><Pill>Ativa</Pill>{podeLancar && <Button secondary onClick={() => abrir({ tipo: "restricao", id: r.id, animalId: r.animalId, propriedadeId: r.propriedadeId })}>Encerrar restrição</Button>}</article>) : <div className="repro-vazio" role="status"><HeartPulse aria-hidden="true"/><strong>Nenhuma restrição vigente registrada</strong></div>}
    </div> : modo === "lactacao" ? <SecaoGeralAnimal id="lactacao-atual-animal" titulo="Lactação atual" icon={Milk} acao={podeLancar ? <MenuAcoesFicha rotulo="Gerenciar lactação" itens={[
      ...(lactacaoAtual ? [
        { id: "corrigir", rotulo: "Corrigir lactação", onSelect: () => setLactacaoCorrigida(lactacaoAtual) },
        { id: "encerrar", rotulo: "Encerrar lactação", onSelect: () => setLactacaoEncerrando(lactacaoAtual) },
      ] : []),
      ...(animalId ? [{ id: "historica", rotulo: "Informar lactação histórica", onSelect: () => setHistoricoLactacao(animalId) }] : []),
    ]}/> : undefined}>
      <dl className="repro-metricas repro-metricas-com-icone">
        <div><dt><Milk aria-hidden="true"/>Situação produtiva</dt><dd>{rotuloLactacao(animal?.situacaoProdutiva)}</dd></div>
        <div><dt><CalendarDays aria-hidden="true"/>Início da lactação</dt><dd>{lactacaoAtual ? formatBRDateISO(lactacaoAtual.inicio) : "Não informado"}</dd></div>
        <div><dt><Clock aria-hidden="true"/>Dias em lactação</dt><dd>{animal?.situacaoProdutiva === "LACTANTE" && animal.del != null ? `${animal.del} dias` : "Não informado"}</dd></div>
      </dl>
      {lactacoes.filter(l => l.encerradaEm).map(l => <article key={l.id} className="repro-lactacao-encerrada"><div><strong>{formatBRDateISO(l.inicio)} a {formatBRDateISO(l.encerradaEm!)}</strong>{l.motivoEncerramento && <p>{l.motivoEncerramento}</p>}</div>{podeLancar && <Button secondary onClick={() => setLactacaoCorrigida(l)}>Corrigir lactação</Button>}<PesoSecagemLactacao lactacao={l} podeLancar={podeLancar} onGerenciar={() => setPesoSecagemMantido(l)}/></article>)}
    </SecaoGeralAnimal> : modo === "crias" ? <>{podeLancar && crias.map(c => <div className="repro-cria-identificacao" key={c.animalId}><span>{c.animal?.brinco ?? c.brinco ?? "Cadastro provisório"}</span><Button secondary onClick={() => abrir({ tipo: "identificacao", id: c.animalId!, animalId: c.animalId! })}>Completar identificação da cria</Button></div>)}</> : <Panel>
      <CabecalhoTabela titulo="Gestação, restrições e lactação" />
      <div className="p-4 space-y-4">
        {painel.animais
          .filter((a) => !animalId || a.animalId === animalId)
          .map((a) => (
            <section className="text-sm space-y-2" key={a.animalId}>
              <h3 className="font-semibold">{a.brinco}</h3>
              <div className="flex flex-wrap items-center gap-3">
                <span>{a.situacaoProdutiva === "LACTANTE" && a.del != null
                  ? `Lactante · DEL ${a.del} (D0)`
                  : rotuloLactacao(a.situacaoProdutiva)}</span>
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
        <PerdasGestacionais painel={painel} animalId={animalId}/>
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
                  Corrigir lactação
                </Button>
              )}
              {podeLancar && !l.encerradaEm && (
                <Button
                  secondary
                  onClick={() => setLactacaoEncerrando(l)}
                >
                  Encerrar lactação
                </Button>
              )}
              <PesoSecagemLactacao lactacao={l} podeLancar={podeLancar} onGerenciar={() => setPesoSecagemMantido(l)} />
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
    </Panel>}
      {lactacaoEncerrando && <FormEncerrarLactacao key={`${lactacaoEncerrando.id}:${lactacaoEncerrando.propriedadeId ?? propriedadeContexto ?? ""}`} lactacao={lactacaoEncerrando} animalRotulo={nome(lactacaoEncerrando.animalId)} propriedadeId={lactacaoEncerrando.propriedadeId ?? propriedadeContexto} onFechar={() => setLactacaoEncerrando(null)} onSalvo={async () => { await onMudou(); setLactacaoEncerrando(null); }} />}
      {pesoSecagemMantido && <FormPesoSecagem key={`${pesoSecagemMantido.id}:${pesoSecagemMantido.propriedadeId ?? propriedadeContexto ?? ""}`} lactacao={pesoSecagemMantido} propriedadeId={pesoSecagemMantido.propriedadeId ?? propriedadeContexto} onFechar={() => setPesoSecagemMantido(null)} onSalvo={async () => { await onMudou(); setPesoSecagemMantido(null); }} />}
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
            {["perda", "restricao"].includes(acao.tipo) && (
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
  </>;
}

function PerdasGestacionais({ painel, animalId, naFicha = false }: { painel: PainelReprodutivo; animalId?: string; naFicha?: boolean }) {
  const perdas = (painel.gestacoes ?? []).filter(g => g.tipoEncerramento === "PERDA" && (!animalId || g.animalId === animalId));
  if (!perdas.length) return null;
  const conteudo = perdas.map(g => <article key={g.id} className="repro-perda-gestacional">
    <div><strong>{g.encerradaEm ? formatBRDateISO(g.encerradaEm) : "Data não informada"}</strong><Pill>{g.status === "ANULADO" ? "Anulada" : "Perda registrada"}</Pill></div>
    {!naFicha && <p>{g.animal?.brinco ?? g.animal?.nome ?? painel.animais.find(a => a.animalId === g.animalId)?.brinco ?? "Animal"}</p>}
    <p>{g.motivoEncerramento ?? "Explicação histórica não informada"}</p>
    <p>Causa clínica: {g.causaClinica ? { DESCONHECIDA: "Desconhecida", SUSPEITA: "Suspeita", CONFIRMADA: "Confirmada" }[g.causaClinica.estado] : "Não informada"}</p>
    {g.causaClinica?.descricao && <p>{g.causaClinica.descricao}</p>}
    {g.causaClinica?.evidencias?.length ? <ul>{g.causaClinica.evidencias.map((e, i) => <li key={i}>{e}</li>)}</ul> : <p>Evidências não informadas.</p>}
  </article>);
  return naFicha ? <SecaoReproducaoAnimal titulo="Histórico de perdas" icon={HeartPulse}>{conteudo}</SecaoReproducaoAnimal> : <details className="rounded-lg border border-border p-4"><summary className="cursor-pointer font-semibold">Perdas gestacionais registradas</summary>{conteudo}</details>;
}
