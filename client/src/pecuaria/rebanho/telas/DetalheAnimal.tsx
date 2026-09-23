// Ficha do animal — página cheia no layout de OperacaoFinanceiraDetalhe.tsx:
// voltar, cabeçalho bg-[#f4f2e9] com brinco + pills, ações no topo, seções em
// grid (dados, composição, localização, destino, pesagens, saída, auditoria).

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { fracaoReduzida } from "../lib/composicao";
import {
  buscarAuditoriaAnimal, buscarFichaAnimal, darSaidaAnimal, desfazerDestinoAnimal, desfazerLocalizacaoAnimal,
  estornarSaidaAnimal, excluirPesagem, obterCatalogos, RebanhoApiError,
} from "../api";
import type { AnimalFicha, Catalogos, EntradaAuditoria, Pesagem } from "../types";
import { formatarDataBR, formatarIdade, rotuloAptidao, rotuloCategoria, rotuloPapelReprodutivo, rotuloSituacao, rotuloTipoSaida } from "../lib/rotulos";
import { ModalMotivo } from "../ui";
import { FormDadosAnimal } from "../forms/FormDadosAnimal";
import { FormComposicao } from "../forms/FormComposicao";
import { FormMovimentar } from "../forms/FormMovimentar";
import { FormDestino } from "../forms/FormDestino";
import { FormPesagem } from "../forms/FormPesagem";
import { FormSaida } from "../forms/FormSaida";
import { ConfirmDialog } from "../../../components/ConfirmDialog";
import { Loader } from "../../../components/Loading";
import { Button, ErrorBox, hoje, Panel, Pill } from "../../../financeiro/financeiro-ui";
import { NavRebanho } from "./NavRebanho";

const ROTULO_TIPO_PESAGEM: Record<string, string> = { NASCIMENTO: "Nascimento", ENTRADA: "Entrada", DESMAMA: "Desmama", ROTINA: "Rotina", SAIDA: "Saída" };

function gmdEntre(atual: { pesoKg: number; data: string }, anterior: { pesoKg: number; data: string } | undefined): string {
  if (!anterior) return "—";
  const dias = (new Date(atual.data).getTime() - new Date(anterior.data).getTime()) / 86_400_000;
  if (dias <= 0) return "—";
  return `${((atual.pesoKg - anterior.pesoKg) / dias).toFixed(3)} kg/dia`;
}

export function DetalheAnimal({ id, onVoltar }: { id: string; onVoltar: () => void }) {
  const [animal, setAnimal] = useState<AnimalFicha | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [auditoria, setAuditoria] = useState<EntradaAuditoria[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const [editandoDados, setEditandoDados] = useState(false);
  const [editandoComposicao, setEditandoComposicao] = useState(false);
  const [movimentando, setMovimentando] = useState(false);
  const [mudandoDestino, setMudandoDestino] = useState(false);
  const [pesagemForm, setPesagemForm] = useState<{ modo: "novo" } | { modo: "editar"; pesagem: Pesagem } | null>(null);
  const [dandoSaida, setDandoSaida] = useState(false);
  const [estornandoSaida, setEstornandoSaida] = useState(false);
  const [excluindoCadastro, setExcluindoCadastro] = useState(false);
  const [desfazendoLocalizacao, setDesfazendoLocalizacao] = useState(false);
  const [desfazendoDestino, setDesfazendoDestino] = useState(false);
  const [excluindoPesagem, setExcluindoPesagem] = useState<Pesagem | null>(null);
  const [emAcao, setEmAcao] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try { setErro(null); setAnimal(await buscarFichaAnimal(id)); }
    catch (e) { setErro(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
  }, [id]);
  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { obterCatalogos().then(setCatalogos).catch(() => undefined); }, []);
  useEffect(() => { buscarAuditoriaAnimal(id).then(setAuditoria).catch(() => setAuditoria([])); }, [id]);

  if (!animal) return <div className="shell-wide pagina-carregando"><button onClick={onVoltar} className="mt-6 mb-5 inline-flex shrink-0 items-center gap-2 self-start text-sm font-semibold text-ink-2"><ArrowLeft size={17} /> Voltar para animais</button><ErrorBox erro={erro} />{!erro && <Loader label="Carregando animal" full />}</div>;

  const ativo = animal.situacao === "ATIVO";
  const localizacaoAtual = animal.historicoLocalizacoes[0] ?? null;
  const destinoAtual = animal.historicoDestinos[0] ?? null;

  const executar = async (fn: () => Promise<AnimalFicha | void>, aoTerminar: () => void) => {
    if (emAcao) return;
    setEmAcao(true); setErroAcao(null);
    try {
      const atualizado = await fn();
      if (atualizado) setAnimal(atualizado);
      else await carregar();
      aoTerminar();
    } catch (e) { setErroAcao(e instanceof RebanhoApiError ? e.message : e instanceof Error ? e.message : String(e)); }
    finally { setEmAcao(false); }
  };

  const excluirPesagemConfirmada = async () => {
    if (!excluindoPesagem) return;
    await executar(async () => { await excluirPesagem(excluindoPesagem.id); }, () => setExcluindoPesagem(null));
  };

  return <div className="shell-wide pagina-financeira">
    <button onClick={onVoltar} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink"><ArrowLeft size={17} /> Voltar para animais</button>
    <NavRebanho ativa="animais" />
    <div className="mt-6"><ErrorBox erro={erro} /></div>
    <Panel className="mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-border bg-[#f4f2e9] p-6">
        <div className="min-w-0 flex-[1_1_280px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{animal.brinco}</span>
            <Pill tone={ativo ? "green" : "neutral"}>{rotuloSituacao(animal.situacao)}</Pill>
            <Pill>{rotuloCategoria(animal.categoria)}</Pill>
            {animal.aptidao && <Pill tone="brown">{rotuloAptidao(animal.aptidao)}</Pill>}
            {animal.papelReprodutivo && animal.papelReprodutivo !== "NENHUM" && <Pill tone="amber">{rotuloPapelReprodutivo(animal.papelReprodutivo)}</Pill>}
          </div>
          <h1 className="mt-2 break-words font-serif text-[clamp(22px,5vw,30px)] leading-tight">{animal.nome || animal.brinco}</h1>
          <p className="mt-2 break-words text-sm text-ink-3">{formatarIdade(animal.idadeMeses)} · {animal.propriedade?.nome ?? "Sem sítio"}{animal.lote ? ` · ${animal.lote.nome}` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ativo ? <>
            <Button secondary onClick={() => setEditandoDados(true)}>Editar dados</Button>
            <Button secondary onClick={() => setEditandoComposicao(true)}>Editar composição</Button>
            <Button secondary onClick={() => setMovimentando(true)}>Movimentar</Button>
            <Button secondary onClick={() => setMudandoDestino(true)}>Mudar destino</Button>
            <Button secondary onClick={() => setPesagemForm({ modo: "novo" })}>Registrar pesagem</Button>
            <Button danger onClick={() => setDandoSaida(true)}>Dar saída</Button>
            <Button danger onClick={() => setExcluindoCadastro(true)}>Excluir cadastro</Button>
          </> : <Button onClick={() => { setErroAcao(null); setEstornandoSaida(true); }}>Estornar saída</Button>}
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Dados</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-xs text-ink-3">Brinco eletrônico</dt><dd className="mt-0.5">{animal.brincoEletronico ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-3">SISBOV</dt><dd className="mt-0.5">{animal.sisbov ?? "—"}</dd></div>
            <div><dt className="text-xs text-ink-3">Sexo</dt><dd className="mt-0.5">{animal.sexo === "F" ? "Fêmea" : "Macho"}</dd></div>
            <div><dt className="text-xs text-ink-3">Origem</dt><dd className="mt-0.5">{animal.origem === "NASCIDO" ? "Nascido na propriedade" : "Comprado"}</dd></div>
            <div><dt className="text-xs text-ink-3">Nascimento</dt><dd className="mt-0.5">{formatarDataBR(animal.dataNascimento)}{animal.nascimentoEstimado ? " (estimado)" : ""}</dd></div>
            <div><dt className="text-xs text-ink-3">Entrada</dt><dd className="mt-0.5">{formatarDataBR(animal.dataEntrada)}</dd></div>
            {animal.sexo === "F" && <div><dt className="text-xs text-ink-3">Partos antes da entrada</dt><dd className="mt-0.5">{animal.partosAntesDaEntrada}</dd></div>}
          </dl>
          {animal.observacao && <p className="mt-4 break-words text-sm text-ink-3">{animal.observacao}</p>}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Composição racial</h2>
          {animal.composicao.length ? <ul className="mt-4 space-y-2 text-sm">{animal.composicao.map((item) => <li key={item.sigla} className="flex items-center justify-between gap-3"><span>{catalogos?.racas.find((raca) => raca.sigla === item.sigla)?.nome ?? item.sigla} ({item.sigla})</span><strong>{fracaoReduzida(item.fracao64)}</strong></li>)}</ul> : <p className="mt-4 text-sm text-ink-3">Sem composição racial informada.</p>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Localização</h2>{ativo && animal.historicoLocalizacoes.length >= 2 && <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoLocalizacao(true); }}>Desfazer última movimentação</button>}</div>
          <p className="mt-4 text-sm">{localizacaoAtual ? <>{localizacaoAtual.propriedade?.nome ?? "Sem sítio"}{localizacaoAtual.lote ? ` · ${localizacaoAtual.lote.nome}` : ""} <span className="text-ink-3">desde {formatarDataBR(localizacaoAtual.desde)}</span></> : "Sem localização registrada."}</p>
          {animal.historicoLocalizacoes.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Sítio</th><th className="py-1 pr-3 font-semibold">Lote</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoLocalizacoes.map((loc) => <tr key={loc.id}><td className="py-1.5 pr-3">{loc.propriedade?.nome ?? "—"}</td><td className="py-1.5 pr-3">{loc.lote?.nome ?? "—"}</td><td className="py-1.5 pr-3">{formatarDataBR(loc.desde)}</td><td className="py-1.5 pr-3">{loc.ate ? formatarDataBR(loc.ate) : "—"}</td></tr>)}</tbody></table></div>}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3"><h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Destino</h2>{ativo && animal.historicoDestinos.length >= 2 && <button className="text-xs font-semibold text-green-800" onClick={() => { setErroAcao(null); setDesfazendoDestino(true); }}>Desfazer última mudança</button>}</div>
          <p className="mt-4 text-sm">{destinoAtual ? <>{rotuloAptidao(destinoAtual.aptidao)}{destinoAtual.papelReprodutivo !== "NENHUM" ? ` · ${rotuloPapelReprodutivo(destinoAtual.papelReprodutivo)}` : ""} <span className="text-ink-3">desde {formatarDataBR(destinoAtual.desde)}</span></> : "Sem destino registrado."}</p>
          {animal.historicoDestinos.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-ink-3"><tr><th className="py-1 pr-3 font-semibold">Aptidão</th><th className="py-1 pr-3 font-semibold">Papel</th><th className="py-1 pr-3 font-semibold">Desde</th><th className="py-1 pr-3 font-semibold">Até</th></tr></thead><tbody className="divide-y divide-border">{animal.historicoDestinos.map((dest) => <tr key={dest.id}><td className="py-1.5 pr-3">{rotuloAptidao(dest.aptidao)}</td><td className="py-1.5 pr-3">{rotuloPapelReprodutivo(dest.papelReprodutivo)}</td><td className="py-1.5 pr-3">{formatarDataBR(dest.desde)}</td><td className="py-1.5 pr-3">{dest.ate ? formatarDataBR(dest.ate) : "—"}</td></tr>)}</tbody></table></div>}
        </section>
      </div>

      <section className="border-t border-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Pesagens</h2>
        {animal.historicoPesagens.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-ink-3"><tr><th className="py-1.5 pr-3 font-semibold">Data</th><th className="py-1.5 pr-3 font-semibold">Peso</th><th className="py-1.5 pr-3 font-semibold">Tipo</th><th className="py-1.5 pr-3 font-semibold">GMD desde a anterior</th><th className="py-1.5 pr-3 font-semibold">Origem</th><th className="py-1.5 pr-3 font-semibold" /></tr></thead><tbody className="divide-y divide-border">{animal.historicoPesagens.map((pesagem, indice) => <tr key={pesagem.id}><td className="py-2 pr-3">{formatarDataBR(pesagem.data)}</td><td className="py-2 pr-3">{pesagem.pesoKg.toLocaleString("pt-BR")} kg</td><td className="py-2 pr-3">{ROTULO_TIPO_PESAGEM[pesagem.tipo] ?? pesagem.tipo}</td><td className="py-2 pr-3">{gmdEntre(pesagem, animal.historicoPesagens[indice + 1])}</td><td className="py-2 pr-3">{pesagem.origem === "BALANCA" ? "Balança" : "Manual"}</td><td className="py-2 pr-3 text-right"><div className="flex justify-end gap-1"><button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Editar pesagem de ${formatarDataBR(pesagem.data)}`} title="Editar pesagem" onClick={() => setPesagemForm({ modo: "editar", pesagem: { id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"] } })}><Pencil size={16} /></button><button type="button" className="rounded-lg p-2 text-ink-2 hover:bg-red-50 hover:text-red-800" aria-label={`Excluir pesagem de ${formatarDataBR(pesagem.data)}`} title="Excluir pesagem" onClick={() => { setErroAcao(null); setExcluindoPesagem({ id: pesagem.id, animalId: animal.id, data: pesagem.data, pesoKg: pesagem.pesoKg, tipo: pesagem.tipo as Pesagem["tipo"], origem: pesagem.origem as Pesagem["origem"] }); }}><Trash2 size={16} /></button></div></td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-ink-3">Nenhuma pesagem registrada.</p>}
      </section>

      <section className="border-t border-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Saída</h2>
        {animal.saida ? <div className="mt-4 space-y-1 text-sm"><p><strong>{rotuloTipoSaida(animal.saida.tipo)}</strong> em {formatarDataBR(animal.saida.data)}{animal.saida.motivo ? ` · ${animal.saida.motivo}` : ""}</p>{animal.saida.observacao && <p className="text-ink-3">{animal.saida.observacao}</p>}{animal.saida.estornadaEm && <p className="text-ink-3">Estornada em {formatarDataBR(animal.saida.estornadaEm)}{animal.saida.estornoMotivo ? ` · ${animal.saida.estornoMotivo}` : ""}</p>}</div> : <p className="mt-4 text-sm text-ink-3">Nenhuma saída registrada.</p>}
      </section>

      <section className="border-t border-border p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Auditoria</h2>
        {auditoria === null ? <p className="mt-4 text-sm text-ink-3">Carregando…</p> : auditoria.length ? <div className="mt-4 divide-y divide-border rounded-lg border border-border">{auditoria.map((entrada, indice) => <div key={indice} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"><div className="min-w-0"><strong className="break-words">{entrada.resumo}</strong><div className="mt-0.5 text-xs text-ink-3">{entrada.usuarioNome ?? "Sistema"}</div></div><span className="shrink-0 text-xs text-ink-3">{formatarDataBR(entrada.em)}</span></div>)}</div> : <p className="mt-4 text-sm text-ink-3">Nenhum registro de auditoria.</p>}
      </section>
    </Panel>

    {editandoDados && <FormDadosAnimal animal={animal} onFechar={() => setEditandoDados(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); setEditandoDados(false); }} />}
    {editandoComposicao && catalogos && <FormComposicao animal={animal} racas={catalogos.racas} onFechar={() => setEditandoComposicao(false)} onSalvo={async () => { setEditandoComposicao(false); await carregar(); }} />}
    {movimentando && catalogos && <FormMovimentar animalIds={[animal.id]} propriedades={catalogos.propriedades} lotes={catalogos.lotes} propriedadeInicial={animal.propriedade?.id} loteInicial={animal.lote?.id} onFechar={() => setMovimentando(false)} onSalvo={async () => { setMovimentando(false); await carregar(); }} />}
    {mudandoDestino && <FormDestino animal={animal} onFechar={() => setMudandoDestino(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); setMudandoDestino(false); }} />}
    {pesagemForm && <FormPesagem animalId={animal.id} pesagem={pesagemForm.modo === "editar" ? pesagemForm.pesagem : null} onFechar={() => setPesagemForm(null)} onSalvo={async () => { setPesagemForm(null); await carregar(); }} />}
    {dandoSaida && catalogos && <FormSaida animal={animal} motivos={catalogos.motivosSaida} onFechar={() => setDandoSaida(false)} onSalvo={async (atualizado) => { setAnimal(atualizado); setDandoSaida(false); }} />}

    {estornandoSaida && <ModalMotivo titulo="Estornar saída" eyebrow={`Animal ${animal.brinco}`} labelManter="Manter saída" labelConfirmar="Confirmar estorno" confirmando={emAcao} erro={erroAcao} onFechar={() => setEstornandoSaida(false)} onConfirmar={(motivo) => { void executar(() => estornarSaidaAnimal(animal.id, { motivo }), () => setEstornandoSaida(false)); }} />}
    {excluindoCadastro && <ModalMotivo titulo="Excluir cadastro" eyebrow={`Animal ${animal.brinco}`} impacto={<p>O animal receberá uma saída do tipo "Cadastro indevido" e deixará de contar como ativo. Esta ação pode ser estornada depois, reabrindo o cadastro.</p>} labelManter="Manter cadastro" labelConfirmar="Excluir cadastro" confirmando={emAcao} erro={erroAcao} onFechar={() => setExcluindoCadastro(false)} onConfirmar={(motivo) => { void executar(() => darSaidaAnimal(animal.id, { data: hoje(), tipo: "CADASTRO_INDEVIDO", motivoId: null, observacao: motivo }), () => setExcluindoCadastro(false)); }} />}

    <ConfirmDialog open={desfazendoLocalizacao} title="Desfazer última movimentação?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>A localização atual será removida e a anterior será reaberta.</p></>} confirmLabel="Desfazer movimentação" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setDesfazendoLocalizacao(false)} onConfirm={() => { void executar(() => desfazerLocalizacaoAnimal(animal.id), () => setDesfazendoLocalizacao(false)); }} />
    <ConfirmDialog open={desfazendoDestino} title="Desfazer última mudança de destino?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>O destino atual será removido e o anterior será reaberto.</p></>} confirmLabel="Desfazer mudança" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setDesfazendoDestino(false)} onConfirm={() => { void executar(() => desfazerDestinoAnimal(animal.id), () => setDesfazendoDestino(false)); }} />
    <ConfirmDialog open={!!excluindoPesagem} title="Excluir pesagem?" message={<>{erroAcao && <p className="mb-2 text-red-700">{erroAcao}</p>}<p>Esta pesagem será removida permanentemente do histórico do animal.</p></>} confirmLabel="Excluir pesagem" cancelLabel="Manter" tone="danger" processando={emAcao} onCancel={() => setExcluindoPesagem(null)} onConfirm={() => { void excluirPesagemConfirmada(); }} />
  </div>;
}
