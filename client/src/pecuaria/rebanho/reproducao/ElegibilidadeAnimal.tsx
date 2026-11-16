import { useEffect, useRef, useState } from "react";
import { RevisarToqueAptidao } from "./RevisarToqueAptidao";
import { Input } from "../../../components/ui/input";
import { Target } from "lucide-react";
import { SecaoReproducaoAnimal } from "./SecaoReproducaoAnimal";
import { ToqueAptidaoFormulario } from "./ToqueAptidaoFormulario";
import { DatePicker } from "../../../components/DatePicker";
import { Button } from "../../../components/ui/button";
import { formatBRDateISO, getHojeISO } from "../../../lib/hoje";
import { decidirElegibilidade, consultarElegibilidade, descreverMotivo, type ElegibilidadeNaData } from "./elegibilidade-api";
import type { PainelReprodutivo } from "./api";
const situacoes: Record<string, string> = { VAZIA: "Vazia", GESTANTE: "Gestante", AGUARDANDO_DIAGNOSTICO: "Aguardando diagnóstico", DESCONHECIDA: "Desconhecida" };
export function ElegibilidadeAnimal({ animalId, propriedadeId, painel, podeLancar, onMudou, naFicha = false }: {
  animalId: string; propriedadeId: number; painel: PainelReprodutivo; podeLancar: boolean; onMudou?: () => void; naFicha?: boolean;
}) {
  const [data, setData] = useState(getHojeISO), [aberto, setAberto] = useState(false), [atualizacao, setAtualizacao] = useState(0);
  const [resultado, setResultado] = useState<ElegibilidadeNaData | null>(null), [erro, setErro] = useState(""), [carregando, setCarregando] = useState(false);
  useEffect(() => { setAberto(false); setData(getHojeISO()); }, [animalId, propriedadeId]);
  useEffect(() => {
    let ativo = true; setResultado(null); setErro(""); setCarregando(Boolean(data));
    if (data) void consultarElegibilidade(animalId, propriedadeId, data).then(r => { if (ativo) setResultado(r); }).catch(e => { if (ativo) setErro(e instanceof Error ? e.message : String(e)); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [animalId, propriedadeId, data, atualizacao, painel]);
  const r = resultado?.animalId === animalId && resultado.propriedadeId === propriedadeId && resultado.dataReferencia === data ? resultado : null;
  const aptidao = r?.aptidao;
  const atualizar = () => { setAtualizacao(v => v + 1); onMudou?.(); };
  const acoes = <><DatePicker aria-label="Data de referência da aptidão" value={data} onChange={setData}/>{podeLancar && <Button variant="outline" onClick={() => setAberto(true)}>Registrar exame de aptidão</Button>}</>;
  const conteudo = <div className="space-y-3">
    {!naFicha && <div className="flex flex-wrap items-center gap-3">{acoes}</div>}
    {carregando && <p role="status">Consultando aptidão…</p>}{erro && <p role="alert">{erro}</p>}
    {r && <><dl className="repro-metricas" aria-label="Situação reprodutiva e aptidão">
      <div><dt>Situação reprodutiva</dt><dd>{situacoes[r.situacaoReprodutiva ?? "DESCONHECIDA"] ?? "Desconhecida"}</dd></div>
      <div><dt>Aptidão</dt><dd>{aptidao?.estado === "APTA" ? "Apta" : aptidao?.estado === "NAO_APTA" ? "Não apta" : "Pendente de avaliação"}</dd></div>
      <div><dt>PEV original</dt><dd>{r.pevOriginalAte ? formatBRDateISO(r.pevOriginalAte) : "Não informado"}</dd></div>
    </dl>
    {aptidao?.data && <p>Exame de {formatBRDateISO(aptidao.data)}{aptidao.exameId && <> · <a className="underline" href={`/pecuaria/sanidade?aba=exames&animalId=${animalId}&detalheTipo=exame&detalheId=${aptidao.exameId}&sitio=${propriedadeId}`}>Ver evidência</a></>}</p>}
    {podeLancar && aptidao?.exameId && <RevisarToqueAptidao combinado={aptidao.finalidadePrincipal !== "APTIDAO_REPRODUTIVA"} key={aptidao.exameId} exameId={aptidao.exameId} propriedadeId={propriedadeId} onMudou={atualizar}/>}
    {podeLancar && aptidao?.bloqueioAnteriorId && r.vinculoCicloId && <EncerrarBloqueioAnterior vinculoCicloId={r.vinculoCicloId} key={aptidao.bloqueioAnteriorId} id={aptidao.bloqueioAnteriorId} propriedadeId={propriedadeId} onMudou={atualizar}/>}
    {aptidao?.retornoEm && <p>Retorno de aptidão: {formatBRDateISO(aptidao.retornoEm)}</p>}
    {r.motivos.map(m => <p key={m}>{descreverMotivo(m)}</p>)}{r.alertas.map(m => <p key={m}>{descreverMotivo(m)}</p>)}
    {r.necessidadeAptidao?.estado === "AVALIACAO_DEVIDA" && <p role="status">Idade/peso ou prazo pós-parto indicam avaliação devida. O aviso não determina aptidão.</p>}
    {r.necessidadeAptidao?.pendencias.map(m => <p key={m}>{descreverMotivo(m)}</p>)}
    {r.acompanhamentoAptidao?.visitasAbertas.map(v => <p key={v.id}><a className="underline" href={`/pecuaria/visitas/${v.id}`}>{v.nome}</a></p>)}
    </>}
    {podeLancar && <ToqueAptidaoFormulario key={`${animalId}:${propriedadeId}`} emModal aberto={aberto} onFechar={() => setAberto(false)} animalId={animalId} propriedadeId={propriedadeId} onMudou={() => { setAberto(false); setAtualizacao(v => v + 1); onMudou?.(); }}/>}
  </div>;
  return naFicha ? <SecaoReproducaoAnimal titulo="Situação reprodutiva e aptidão" icon={Target} acao={acoes}>{conteudo}</SecaoReproducaoAnimal> : conteudo;
}

function EncerrarBloqueioAnterior({ vinculoCicloId, propriedadeId, onMudou }: { id: string; vinculoCicloId: string; propriedadeId: number; onMudou: () => void }) {
  const [motivo, setMotivo] = useState(""), [erro, setErro] = useState(""), [ocupado, setOcupado] = useState(false);
  const chave = useRef<{ motivo: string; chave: string } | null>(null);
  return <details><summary>Revisar bloqueio anterior</summary><form className="space-y-3" onSubmit={async e => {
    e.preventDefault(); if (ocupado) return; setOcupado(true); setErro("");
    if (chave.current?.motivo !== motivo) chave.current = { motivo, chave: crypto.randomUUID() };
    try { await decidirElegibilidade({ vinculoCicloId, propriedadeId, motivo, chave: chave.current.chave, data: getHojeISO(), tipo: "RETOMAR_POLITICA", aptaDesde: null }); onMudou(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível encerrar o bloqueio."); }
    finally { setOcupado(false); }
  }}><p>Registre o encerramento de hoje com motivo. O bloqueio anterior é preservado; um novo exame posterior ao encerramento será necessário.</p><label>Motivo do encerramento<Input required minLength={5} maxLength={1000} value={motivo} onChange={e => setMotivo(e.target.value)}/></label>{erro && <p role="alert">{erro}</p>}<Button disabled={ocupado} type="submit">Encerrar bloqueio anterior</Button></form></details>;
}
