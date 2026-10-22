import { useEffect, useState } from "react";
import { consultarLeite } from "./operacoes-api";
import { NovaAmostra } from "./QualidadeLeite";
import type { AmostraQualidade, FormatoQualidade } from "./qualidade-types";
export function SelecaoQualidadeFechamento({ sitio, inicio, fim, selecionadas, onChange, ocupado }: {
  sitio: number; inicio: string; fim: string; selecionadas: { amostraId: string; versaoEsperada: number }[];
  onChange: (v: { amostraId: string; versaoEsperada: number }[]) => void; ocupado: boolean;
}) {
  const [pagina, setPagina] = useState(1), [revisao, setRevisao] = useState(0), [nova, setNova] = useState(false);
  const [dados, setDados] = useState<{ itens: AmostraQualidade[]; total: number; tamanho: number } | null>(null);
  const [formatos, setFormatos] = useState<FormatoQualidade[]>([]), [erro, setErro] = useState("");
  useEffect(() => {
    let ativa = true; setDados(null); setErro("");
    void Promise.all([consultarLeite<{ itens: AmostraQualidade[]; total: number; tamanho: number }>(`/qualidade/amostras?${new URLSearchParams({ inicio, fim, pagina: String(pagina), tamanho: "20" })}`, sitio), consultarLeite<FormatoQualidade[]>("/qualidade/formatos", sitio)])
      .then(([a, f]) => { if (ativa) { setDados(a); setFormatos(f); } })
      .catch(e => { if (ativa) setErro(e instanceof Error ? e.message : "Não foi possível consultar amostras"); });
    return () => { ativa = false; };
  }, [sitio, inicio, fim, pagina, revisao]);
  return <section aria-label="Qualidade opcional do fechamento">
    <h2>Laudos do acordo (opcional)</h2>
    <p>Selecione amostras já registradas ou registre uma nova. O fechamento funciona sem amostra, resultado ou fórmula de qualidade. Cada vínculo conserva a versão selecionada.</p>
    {erro && <p role="alert">{erro}. Você pode fechar sem vincular amostras.</p>}
    {!dados && !erro && <p role="status">Consultando amostras do período…</p>}
    <fieldset disabled={ocupado}><legend>Amostras de {inicio} até {fim}</legend>
      {dados?.itens.filter(a => a.status === "VALIDO").map(a => <label className="leite-checkbox" key={a.id}><input type="checkbox" checked={selecionadas.some(s => s.amostraId === a.id)} onChange={e => onChange(e.target.checked ? [...selecionadas.filter(s => s.amostraId !== a.id), { amostraId: a.id, versaoEsperada: a.versao }] : selecionadas.filter(s => s.amostraId !== a.id))} />{a.data} · {a.sujeito.tipo === "COLETIVO" ? a.sujeito.origem : a.animal?.brinco} · {a.formatoSnapshot.nome} · versão {a.versao}{!a.resultados.length ? " · Resultado pendente" : ""}</label>)}
      {dados && !dados.itens.length && <p>Nenhuma amostra neste período.</p>}
      <p>{selecionadas.length} amostra(s) selecionada(s), incluindo outras páginas.</p>
      {!!selecionadas.length && <button type="button" onClick={() => onChange([])}>Remover todos os vínculos desta versão</button>}
      <button type="button" className="leite-secondary" onClick={() => setNova(true)}>Registrar nova amostra para selecionar</button>
      <div className="leite-form-inline"><button type="button" disabled={pagina === 1} onClick={() => setPagina(p => p - 1)}>Amostras anteriores</button><span>Página {pagina}</span><button type="button" disabled={!dados || pagina * dados.tamanho >= dados.total} onClick={() => setPagina(p => p + 1)}>Próximas amostras</button></div>
    </fieldset>
    {nova && <NovaAmostra formatos={formatos} sitio={sitio} onCancelar={() => setNova(false)} onSalvo={a => {
      setNova(false); setRevisao(r => r + 1);
      if (a.data >= inicio && a.data <= fim) onChange([...selecionadas.filter(s => s.amostraId !== a.id), { amostraId: a.id, versaoEsperada: a.versao }]);
      else setErro("Amostra registrada na Qualidade, mas fora do período deste acordo. Ela não foi vinculada");
    }} />}
  </section>;
}
