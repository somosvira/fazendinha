import { useId } from "react";
import { Bar, Cell, ComposedChart, CartesianGrid, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/button";
import type { DefinicaoMeta, IndicadorMeta, Meta } from "./metas-api";
import { formatBRDateISO, getHojeISO } from "../lib/hoje";

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const dataBR = formatBRDateISO;
const diaMes = (d: string) => dataBR(d).slice(0, 5);
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesCurto = (d: string) => MESES[Number(d.slice(5, 7)) - 1];
const JANELA = 30;

/** Dentro do alvo para metas numéricas; marcos não se medem por valor. */
export function dentroDoAlvo(valor: number, d: DefinicaoMeta) {
  if (d.tipo === "minimo") return valor >= d.minimo!;
  if (d.tipo === "maximo") return valor <= d.maximo!;
  if (d.tipo === "faixa") return valor >= d.minimo! && valor <= d.maximo!;
  return true;
}

/** Quanto o valor está do alvo, em palavras, e se isso é bom. */
export function distanciaDoAlvo(valor: number, d: DefinicaoMeta, unidade: string) {
  const u = unidade ? ` ${unidade}` : "";
  if (d.tipo === "minimo") return valor >= d.minimo! ? { texto: `${numero(valor - d.minimo!)}${u} acima do mínimo`, bom: true } : { texto: `${numero(d.minimo! - valor)}${u} abaixo do mínimo`, bom: false };
  if (d.tipo === "maximo") return valor <= d.maximo! ? { texto: `${numero(d.maximo! - valor)}${u} abaixo do máximo`, bom: true } : { texto: `${numero(valor - d.maximo!)}${u} acima do máximo`, bom: false };
  if (valor < d.minimo!) return { texto: `${numero(d.minimo! - valor)}${u} abaixo da faixa`, bom: false };
  if (valor > d.maximo!) return { texto: `${numero(valor - d.maximo!)}${u} acima da faixa`, bom: false };
  return { texto: "dentro da faixa", bom: true };
}

/** Datas como "26/10", "30 e 31/10", "27/10 a 03/11" (três ou mais seguidas) ou "20/10, 22/10 e 24/10". */
export function listaDatas(datas: string[]) {
  const ordenadas = [...new Set(datas)].sort();
  if (ordenadas.length === 0) return "";
  const seguidas = ordenadas.every((d, i) => i === 0 || Date.parse(`${d}T12:00:00Z`) - Date.parse(`${ordenadas[i - 1]}T12:00:00Z`) === 864e5);
  const curtas = ordenadas.map(diaMes);
  if (ordenadas.length >= 3 && seguidas) return `${curtas[0]} a ${curtas.at(-1)}`;
  if (curtas.length === 2 && curtas[0].slice(3) === curtas[1].slice(3)) return `${curtas[0].slice(0, 2)} e ${curtas[1]}`;
  return curtas.length > 1 ? `${curtas.slice(0, -1).join(", ")} e ${curtas.at(-1)}` : curtas[0];
}
/** Primeira frase do motivo, começando em minúscula para seguir os dois-pontos. */
const motivoCurto = (motivo: string) => { const frase = motivo.split(/(?<=\.)\s/)[0].replace(/\.$/, ""); return frase.charAt(0).toLocaleLowerCase("pt-BR") + frase.slice(1); };

type Leitura = { ultima: { data: string; valor: number }; distancia: { texto: string; bom: boolean }; noAlvo: number; total: number; media: number; melhor: { data: string; valor: number }; sequencia: number; dentro: boolean };
/** Números que respondem "como está a meta" sem precisar ler o gráfico. */
export function leituraMeta(meta: Meta, unidade: string): Leitura | null {
  const d = meta.definicao;
  const medidas = meta.medicoes.filter((m): m is typeof m & { valor: number } => m.valor !== null).slice(-JANELA);
  const ultima = medidas.at(-1);
  if (!ultima || d.tipo === "marco") return null;
  const dentro = dentroDoAlvo(ultima.valor, d);
  let sequencia = 0;
  for (let i = medidas.length - 1; i >= 0 && dentroDoAlvo(medidas[i].valor, d) === dentro; i--) sequencia++;
  const melhor = medidas.reduce((a, b) => (d.tipo === "maximo" ? b.valor < a.valor : b.valor > a.valor) ? b : a);
  return {
    ultima, dentro, sequencia, total: medidas.length,
    distancia: distanciaDoAlvo(ultima.valor, d, unidade),
    noAlvo: medidas.filter((m) => dentroDoAlvo(m.valor, d)).length,
    media: medidas.reduce((s, m) => s + m.valor, 0) / medidas.length,
    melhor,
  };
}

/** Rótulo da situação com contexto: "Fora do alvo há 2 dias". */
export function situacaoMeta(meta: Meta, leitura: Leitura | null) {
  const d = meta.definicao;
  if (d.tipo === "marco") {
    const ultima = meta.medicoes.at(-1);
    if (ultima?.concluido) return { texto: "Concluído", classe: "ok" };
    if (d.etapas?.length) return { texto: `${ultima?.etapasConcluidas?.length ?? 0} de ${d.etapas.length} etapas`, classe: "marco" };
    return { texto: "Em aberto", classe: "marco" };
  }
  if (!leitura) return { texto: "Sem medição", classe: "neutro" };
  const unidade = d.periodo === "mensal" ? ["mês", "meses"] : d.periodo === "diario" ? ["dia", "dias"] : ["medição", "medições"];
  const ha = leitura.sequencia > 1 ? ` há ${leitura.sequencia} ${unidade[1]}` : "";
  return leitura.dentro ? { texto: `No alvo${ha}`, classe: "ok" } : { texto: `Fora do alvo${ha}`, classe: "fora" };
}

export function grupoMeta(meta: Meta, leitura: Leitura | null): "fora" | "ok" | "marco" | "neutro" {
  if (meta.definicao.tipo === "marco") return "marco";
  return leitura ? (leitura.dentro ? "ok" : "fora") : "neutro";
}

/** Link para conferir as ordenhas de um intervalo, no mesmo formato da proveniência das medições. */
const urlOrdenhas = (propriedadeId: number, inicio: string, fim: string) => `/pecuaria/leite?propriedadeId=${propriedadeId}&leiteSecao=ordenhas&leiteModo=geral&ordenhasInicio=${inicio}&ordenhasFim=${fim}`;

export function CartaoMeta({ meta, indicador: i, podeEditar, sitio, onRegistrar, onEditar, onHistorico, onAbrir }: {
  meta: Meta; indicador: IndicadorMeta; podeEditar: boolean; sitio?: string;
  onRegistrar: () => void; onEditar: () => void; onHistorico: () => void; onAbrir: (url: string) => void;
}) {
  const d = meta.definicao;
  const leitura = leituraMeta(meta, i.unidade);
  const situacao = situacaoMeta(meta, leitura);
  const ultimaMedicao = meta.medicoes.at(-1);
  const pendencias = meta.pendencias ?? [];
  const porMotivo = [...pendencias.reduce((m, p) => m.set(p.motivo, [...(m.get(p.motivo) ?? []), p.data]), new Map<string, string[]>())];
  const pendenteParcelas = porMotivo.find(([motivo]) => /parcela/i.test(motivo));
  const definicaoTexto = `${i.nome} · ${alvoTexto(d, i.unidade)}${d.periodo === "diario" ? " por dia" : d.periodo === "mensal" ? " por mês" : ""} · ${d.fonte === "automatica" ? "apuração automática" : "medição manual"}`;
  const link = (url: string, texto: string, className = "metas-link") => <a className={className} href={url} onClick={(e) => { e.preventDefault(); onAbrir(url); }}>{texto}</a>;
  return <article className="metas-meta" aria-labelledby={`meta-${meta.id}`}>
    <header className="metas-identidade">
      <div><h3 id={`meta-${meta.id}`}>{d.titulo}</h3><p>{definicaoTexto}</p>{sitio && <p>{sitio}</p>}</div>
      <span className={`metas-situacao metas-situacao-${situacao.classe}`}>{situacao.texto}</span>
    </header>
    <div className="metas-corpo">
      {d.tipo === "marco" ? <LeituraMarco meta={meta} /> : leitura ? <dl className="metas-atual">
        <dt>{d.periodo === "mensal" ? `${mesCurto(leitura.ultima.data)}/${leitura.ultima.data.slice(0, 4)}` : `Última medição · ${dataBR(leitura.ultima.data)}`}</dt>
        <dd><span className="metas-grande">{numero(leitura.ultima.valor)} {i.unidade}</span><span className={`metas-delta ${leitura.distancia.bom ? "bom" : "ruim"}`}>{leitura.distancia.texto}</span></dd>
        <div className="metas-fatos">
          <div><dt>{d.periodo === "diario" ? "Dias no alvo" : d.periodo === "mensal" ? "Meses no alvo" : "Medições no alvo"}</dt><dd>{leitura.noAlvo} de {leitura.total}</dd></div>
          <div><dt>Média</dt><dd>{numero(leitura.media)} {i.unidade}</dd></div>
          <div><dt>Melhor</dt><dd>{numero(leitura.melhor.valor)} {i.unidade} · {diaMes(leitura.melhor.data)}</dd></div>
          <div><dt>Prazo</dt><dd>{d.prazo ? dataBR(d.prazo) : "Contínua"}</dd></div>
        </div>
      </dl> : <div className="metas-atual metas-sem-medicao"><p>Nenhuma medição ainda.</p><p>{d.fonte === "automatica" ? "A apuração automática registra os dias que fecham." : "A evolução aparece depois da primeira medição."}</p></div>}
      {d.tipo === "marco" ? <EtapasMarco meta={meta} /> : meta.medicoes.length > 0 || pendencias.length > 0 ? (d.periodo === "mensal" ? <BarrasMeta meta={meta} unidade={i.unidade} /> : <LinhaMeta meta={meta} unidade={i.unidade} />) : null}
    </div>
    <footer className="metas-rodape-cartao">
      <span className={pendencias.length ? "metas-pendencia" : undefined}>
        {porMotivo.length ? <>Sem apuração · {porMotivo.slice(0, 2).map(([motivo, datas]) => `${listaDatas(datas)}: ${motivoCurto(motivo)}`).join(" · ")}.{porMotivo.length > 2 && ` E mais ${porMotivo.slice(2).reduce((n, [, datas]) => n + datas.length, 0)} dias por outros motivos.`}</>
          : d.tipo === "marco" ? proximaEtapa(meta)
          : d.fonte === "manual" && d.periodo === "mensal" && !medidoNoMesAtual(meta) ? "Medição deste mês ainda não registrada."
          : d.observacao || null}
      </span>
      <div>
        {pendenteParcelas && link(urlOrdenhas(meta.propriedadeId, [...pendenteParcelas[1]].sort()[0], [...pendenteParcelas[1]].sort().at(-1)!), "Confirmar parcelas", "metas-link-forte")}
        {podeEditar && d.fonte === "manual" && <Button variant="outline" size="sm" onClick={onRegistrar}>{d.tipo === "marco" ? "Atualizar andamento" : "Registrar medição"}</Button>}
        {ultimaMedicao?.proveniencia?.url && link(ultimaMedicao.proveniencia.url, "Ver ordenhas")}
        <Button variant="ghost" size="sm" onClick={onHistorico}>Histórico</Button>
        {podeEditar && <Button variant="ghost" size="sm" aria-describedby={`meta-${meta.id}`} onClick={onEditar}>Editar meta</Button>}
      </div>
    </footer>
  </article>;
}

function alvoTexto(d: DefinicaoMeta, unidade: string) {
  if (d.tipo === "marco") return d.prazo ? `prazo ${dataBR(d.prazo)}` : "sem prazo";
  if (d.tipo === "faixa") return `entre ${numero(d.minimo!)} e ${numero(d.maximo!)} ${unidade}`;
  return `${d.tipo === "minimo" ? "mínimo de" : "máximo de"} ${numero((d.tipo === "minimo" ? d.minimo : d.maximo)!)} ${unidade}`;
}
function medidoNoMesAtual(meta: Meta) {
  const mes = getHojeISO().slice(0, 7);
  return meta.medicoes.some((m) => m.data.startsWith(mes));
}
function proximaEtapa(meta: Meta) {
  const ultima = meta.medicoes.at(-1);
  if (ultima?.concluido) return "Marco concluído.";
  const proxima = meta.definicao.etapas?.find((e) => !ultima?.etapasConcluidas?.includes(e.id));
  return proxima ? `Próxima etapa: ${proxima.titulo}.` : null;
}

function LeituraMarco({ meta }: { meta: Meta }) {
  const d = meta.definicao, ultima = meta.medicoes.at(-1);
  const total = d.etapas?.length ?? 0, feitas = ultima?.etapasConcluidas?.length ?? 0;
  const dias = d.prazo ? Math.ceil((Date.parse(`${d.prazo}T12:00:00Z`) - Date.now()) / 864e5) : null;
  return <dl className="metas-atual">
    <dt>Andamento</dt>
    <dd>{total ? <><span className="metas-grande">{feitas} de {total}</span><span className="metas-progresso" role="progressbar" aria-label="Etapas concluídas" aria-valuemin={0} aria-valuemax={total} aria-valuenow={feitas}><i style={{ width: `${(feitas / total) * 100}%` }} /></span></>
      : <span className="metas-grande">{ultima?.concluido ? "Concluído" : "Em aberto"}</span>}
      {dias !== null && !ultima?.concluido && <span className={`metas-delta ${dias < 0 ? "ruim" : ""}`}>{dias < 0 ? `${-dias} ${-dias === 1 ? "dia" : "dias"} depois do prazo` : `${dias} ${dias === 1 ? "dia" : "dias"} até o prazo`}</span>}</dd>
  </dl>;
}
function EtapasMarco({ meta }: { meta: Meta }) {
  const d = meta.definicao, ultima = meta.medicoes.at(-1);
  if (!d.etapas?.length) return <p className="metas-sem-etapas">{ultima?.concluido ? "Conclusão registrada." : "A conclusão é registrada como um fato, sem percentual estimado."}</p>;
  const proxima = d.etapas.find((e) => !ultima?.etapasConcluidas?.includes(e.id));
  return <ol className="metas-etapas" aria-label={`${ultima?.etapasConcluidas?.length ?? 0} de ${d.etapas.length} etapas concluídas`}>
    {d.etapas.map((e) => { const feita = !!ultima?.etapasConcluidas?.includes(e.id); return <li key={e.id} className={feita ? "feita" : e === proxima ? "agora" : undefined}><span className="metas-marca" aria-hidden>{feita ? "✓" : ""}</span><span>{e.titulo}</span><span className="sr-only">{feita ? "concluída" : "pendente"}</span></li>; })}
  </ol>;
}

/** Margem do eixo: o alvo nunca encosta na borda do gráfico. */
function dominio(valores: number[], d: DefinicaoMeta): [number, number] {
  const alvos = [d.minimo, d.maximo].filter((v): v is number => v !== null);
  const todos = [...valores, ...alvos];
  const min = Math.min(...todos), max = Math.max(...todos);
  const folga = Math.max((max - min) * 0.15, Math.abs(max) * 0.05, 1);
  return [Math.max(0, Math.floor(min - folga)), Math.ceil(max + folga)];
}
function AlvoReferencias({ d, unidade, limites, faixa = true }: { d: DefinicaoMeta; unidade: string; limites: [number, number]; faixa?: boolean }) {
  const cor = "var(--metas-atencao)";
  return <>
    {faixa && d.tipo === "minimo" && <ReferenceArea y1={limites[0]} y2={d.minimo!} fill="var(--metas-fora-fundo)" fillOpacity={1} />}
    {faixa && d.tipo === "maximo" && <ReferenceArea y1={d.maximo!} y2={limites[1]} fill="var(--metas-fora-fundo)" fillOpacity={1} />}
    {faixa && d.tipo === "faixa" && <ReferenceArea y1={d.minimo!} y2={d.maximo!} fill="var(--metas-ok-fundo)" fillOpacity={1} />}
    {d.minimo !== null && <ReferenceLine y={d.minimo} stroke={cor} strokeWidth={2} strokeDasharray="6 4" label={{ value: `Mínimo ${numero(d.minimo)} ${unidade}`, position: "insideBottomLeft", fill: cor, fontSize: 11, fontWeight: 600 }} />}
    {d.maximo !== null && <ReferenceLine y={d.maximo} stroke={cor} strokeWidth={2} strokeDasharray="6 4" label={{ value: `Máximo ${numero(d.maximo)} ${unidade}`, position: "insideTopLeft", fill: cor, fontSize: 11, fontWeight: 600 }} />}
  </>;
}

/** Linha diária: dias fora do alvo marcados e dias sem apuração hachurados, sem virar queda. */
function LinhaMeta({ meta, unidade }: { meta: Meta; unidade: string }) {
  const d = meta.definicao, padrao = `metas-hachura-${useId().replace(/:/g, "")}`;
  const pendentes = new Set((meta.pendencias ?? []).map((p) => p.data));
  const datas = [...new Set([...meta.medicoes.map((m) => m.data), ...pendentes])].sort().slice(-JANELA);
  const valores = meta.medicoes.filter((m) => m.valor !== null).map((m) => m.valor!);
  const limites = dominio(valores, d);
  const dados = datas.map((data) => { const v = meta.medicoes.find((m) => m.data === data)?.valor ?? null; return { data, valor: v, pendente: pendentes.has(data) && v === null ? limites[1] : null }; });
  const fora = dados.filter((p) => p.valor !== null && !dentroDoAlvo(p.valor, d)).length;
  return <figure className="metas-grafico" aria-label={`${d.titulo}: ${valores.length} medições, ${fora} fora do alvo, ${pendentes.size} dias sem apuração.`}>
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs><pattern id={padrao} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--metas-hachura)" strokeWidth="2" /></pattern></defs>
        <CartesianGrid vertical={false} stroke="var(--metas-grade)" />
        <XAxis dataKey="data" tickFormatter={diaMes} tick={{ fontSize: 11 }} minTickGap={24} />
        <YAxis domain={limites} tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => numero(Number(v))} allowDataOverflow />
        <AlvoReferencias d={d} unidade={unidade} limites={limites} />
        <Bar dataKey="pendente" fill={`url(#${padrao})`} barSize={14} isAnimationActive={false} />
        <Tooltip labelFormatter={(v) => dataBR(String(v))} formatter={(v, nome) => nome === "pendente" ? ["sem apuração", "Situação"] : [`${numero(Number(v))} ${unidade}`, "Medição"]} />
        <Line type="linear" dataKey="valor" stroke="var(--metas-linha)" strokeWidth={2.5} connectNulls={false} isAnimationActive={false}
          dot={(p: { cx?: number; cy?: number; payload: { valor: number | null }; index: number }) => p.payload.valor === null || p.cx == null || p.cy == null ? <g key={p.index} /> : <circle key={p.index} cx={p.cx} cy={p.cy} r={dentroDoAlvo(p.payload.valor, d) ? 2.5 : 4} fill={dentroDoAlvo(p.payload.valor, d) ? "var(--metas-linha)" : "var(--metas-fora)"} />} />
      </ComposedChart>
    </ResponsiveContainer>
    <figcaption><span><i className="metas-legenda-alvo" />Alvo</span><span><i className="metas-legenda-fora" />Fora do alvo</span>{pendentes.size > 0 && <span><i className="metas-legenda-hachura" />Sem apuração</span>}</figcaption>
  </figure>;
}

/** Barras mensais com o limite: o mês fora do alvo muda de cor. */
function BarrasMeta({ meta, unidade }: { meta: Meta; unidade: string }) {
  const d = meta.definicao;
  const dados = meta.medicoes.filter((m) => m.valor !== null).slice(-12).map((m) => ({ data: m.data, valor: m.valor! }));
  const limites = dominio(dados.map((p) => p.valor), d);
  return <figure className="metas-grafico" aria-label={`${d.titulo}: ${dados.length} meses, ${dados.filter((p) => !dentroDoAlvo(p.valor, d)).length} fora do alvo.`}>
    <ResponsiveContainer width="100%" height={210}>
      <ComposedChart data={dados} margin={{ top: 18, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--metas-grade)" />
        <XAxis dataKey="data" tickFormatter={mesCurto} tick={{ fontSize: 11 }} />
        <YAxis domain={[0, limites[1]]} tick={{ fontSize: 11 }} width={48} tickFormatter={(v) => numero(Number(v))} />
        <Tooltip labelFormatter={(v) => dataBR(String(v))} formatter={(v) => [`${numero(Number(v))} ${unidade}`, "Medição"]} />
        <Bar dataKey="valor" barSize={28} radius={[4, 4, 0, 0]} isAnimationActive={false} label={{ position: "top", fontSize: 11, formatter: (v: unknown) => numero(Number(v)) }}>
          {dados.map((p) => <Cell key={p.data} fill={dentroDoAlvo(p.valor, d) ? "var(--metas-barra)" : "var(--metas-fora)"} />)}
        </Bar>
        <AlvoReferencias d={d} unidade={unidade} limites={[0, limites[1]]} faixa={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </figure>;
}
