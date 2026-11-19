import { rotuloUnidade, type UnidadeMedida } from "@/lib/unidades";

const numero = (valor: string) => valor.replace(".", ",");

type Fonte = { url: string; secao: string; pagina?: number };
export type ReferenciaMedicamento = {
  fonte: string; titulo: string; consultadaEm: string; especie: string | null;
  concentracao: string | null; dosagem: string | null; via: string | null; cuidados: string | null;
  versao?: number; pendencias?: { campo: string; motivo: string }[];
  tipoFonte?: "BULA_OFICIAL" | "FICHA_OFICIAL";
  proporcoes?: { quantidade: string; quantidadeMaxima?: string; unidade: UnidadeMedida; pesoKg: string; condicao: string }[];
  carencias?: Record<"leite" | "carne", { estado: "PRAZO" | "PROIBIDO" | "NAO_INFORMADO"; horas: number | null; condicao: string }>;
  camposFonte?: Record<string, Fonte>;
  documentoSha256?: string; origemOficial?: string; registroMapa?: string; revisaoDocumento?: string;
};

export type ConferenciaBula = { estado: "PESQUISA_PENDENTE" | "CONFERENCIA_PENDENTE" | "IDENTIDADE_PENDENTE"; pendencias: { campo: string; motivo: string }[]; fontesParaConferencia?: string[] };
const campos: Record<string, string> = { especie: "Espécie", concentracao: "Composição", dosagem: "Dosagem", via: "Via de aplicação", cuidados: "Cuidados e conservação", carenciasLeite: "Carência do leite", carenciasCarne: "Carência para abate", carencias: "Carências", identidade: "Identidade do medicamento", apresentacao: "Apresentação", pesquisa: "Pesquisa da fonte", intervalo: "Intervalo entre aplicações", duracao: "Duração do tratamento" };
export function PendenciasMedicamento({ pendencias, fontes = [] }: { pendencias: { campo: string; motivo: string }[]; fontes?: string[] }) {
  return <section className="grid gap-3 rounded-lg bg-surface-2 p-3" aria-label="Pendências da referência"><h3 className="font-semibold">Pendente de conferência</h3><ul className="grid gap-2">{pendencias.map((p, i) => <li key={i}><strong>{campos[p.campo] ?? p.campo}:</strong> {p.motivo}</li>)}</ul>{fontes.filter(u => u.startsWith("https://")).map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer">Fonte a conferir</a>)}</section>;
}

function FonteMedicamento({ referencia }: { referencia?: Fonte }) {
  if (!referencia || !referencia.url.startsWith("https://")) return null;
  return <small className="block mt-1"><a href={referencia.url} target="_blank" rel="noopener noreferrer">Fonte — {referencia.secao}{referencia.pagina ? ", página " + referencia.pagina : ""}</a></small>;
}

export function ConteudoReferenciaMedicamento({ referencia: r }: { referencia: ReferenciaMedicamento }) {
  const pendencias = r.pendencias ?? (["leite", "carne"] as const).flatMap(destino => r.carencias?.[destino]?.estado === "NAO_INFORMADO" ? [{ campo: destino === "leite" ? "carenciasLeite" : "carenciasCarne", motivo: r.carencias[destino].condicao }] : []);
  return <section className="grid gap-3 rounded-lg bg-surface-2 p-3">
    <h3 className="font-semibold">Informações oficiais{r.especie ? ` para ${r.especie}` : ""}</h3>
    <p>{r.tipoFonte === "FICHA_OFICIAL" ? "Ficha do fabricante" : "Bula do fabricante"}{r.revisaoDocumento ? " · " + r.revisaoDocumento : ""}{r.versao === 3 ? " · Informações parciais" : ""}</p>
    {r.concentracao && <p><strong>Composição:</strong> {r.concentracao}<FonteMedicamento referencia={r.camposFonte?.concentracao} /></p>}
    {r.dosagem && <p><strong>Dosagem descrita na fonte:</strong> {r.dosagem}<FonteMedicamento referencia={r.camposFonte?.dosagem} /></p>}
    {!!r.proporcoes?.length && <div><h3 className="font-semibold">Proporção por peso descrita na fonte</h3><ul className="grid gap-2">
      {r.proporcoes.map((p, i) => <li key={i}>{numero(p.quantidade)}{p.quantidadeMaxima ? " a " + numero(p.quantidadeMaxima) : ""} {rotuloUnidade(p.unidade)} para {numero(p.pesoKg)} kg. {p.condicao}</li>)}
    </ul><FonteMedicamento referencia={r.camposFonte?.proporcoes} /></div>}
    {r.via && <p>Via descrita na fonte: {r.via}<FonteMedicamento referencia={r.camposFonte?.via} /></p>}
    {r.carencias && <dl className="grid gap-3">{(["leite", "carne"] as const).map(destino => {
      const prazo = r.carencias![destino];
      const texto = prazo.estado === "PROIBIDO" ? "Uso proibido nas condições descritas" :
        prazo.estado === "NAO_INFORMADO" ? "Prazo não informado" :
        prazo.horas === 0 ? "Carência zero expressamente informada" : prazo.horas + " h";
      return <div key={destino}><dt>Carência de {destino} na fonte</dt><dd><strong>{texto}</strong>. {prazo.condicao}
        <FonteMedicamento referencia={r.camposFonte?.[destino === "leite" ? "carenciasLeite" : "carenciasCarne"]} />
      </dd></div>;
    })}</dl>}
    {r.cuidados && <p>{r.cuidados}<FonteMedicamento referencia={r.camposFonte?.cuidados} /></p>}
    {!!pendencias.length && <PendenciasMedicamento pendencias={pendencias} />}
    <p>Consulta registrada em {r.consultadaEm}.</p>
    {r.registroMapa && <p>Registro MAPA {r.registroMapa}</p>}
    {r.fonte.startsWith("https://") && <a href={r.fonte} target="_blank" rel="noopener noreferrer">Abrir documento oficial</a>}
  </section>;
}
