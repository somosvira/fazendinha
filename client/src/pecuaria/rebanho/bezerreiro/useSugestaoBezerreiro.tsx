import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { consultarBezerreiro } from './api';
import type { Configuracao, Perfil } from './types';

/** A sugestão é uma conveniência; a participação depende do lote enviado ao servidor. */
export function useSugestaoBezerreiro(sitio: number | undefined, habilitada = true, lotesDisponiveis?: readonly {id:string}[]) {
  const [tentativa, setTentativa] = useState(0);
  const [estado, setEstado] = useState<{sitio: number; perfis: Perfil[]; erro: string} | null>(null);
  useEffect(() => {
    let vigente = true;
    setEstado(null);
    if (sitio && habilitada) void consultarBezerreiro<Configuracao>('/configuracoes', sitio)
      .then(c => { if (vigente) setEstado({sitio, perfis: c.perfis.filter(p => p.ativo && p.lote.ativo !== false && (p.lote.propriedadeId == null || p.lote.propriedadeId === sitio)), erro: ''}); })
      .catch(() => { if (vigente) setEstado({sitio, perfis: [], erro: 'Não foi possível consultar a sugestão de Bezerreiro. Você pode escolher o lote manualmente.'}); });
    return () => { vigente = false; };
  }, [sitio, habilitada, tentativa]);
  const atual = habilitada && estado?.sitio === sitio ? estado : null;
  return {perfis: (atual?.perfis ?? []).filter(p => !lotesDisponiveis || lotesDisponiveis.some(l => l.id === p.loteId)), erro: atual?.erro ?? '', carregando: !!sitio && habilitada && !atual, tentar: () => setTentativa(n => n + 1)};
}

export function AjudaDestinoBezerreiro({sugestao, loteId, elegivel}: {sugestao: ReturnType<typeof useSugestaoBezerreiro>; loteId?: string; elegivel: boolean}) {
  const configurado = sugestao.perfis.some(p => p.loteId === loteId);
  return <div className="text-sm text-ink-3 sm:col-span-2" aria-live="polite">
    {sugestao.erro && <p role="alert">{sugestao.erro} <Button type="button" variant="outline" onClick={sugestao.tentar}>Tentar novamente</Button></p>}
    {elegivel && sugestao.carregando && <p>Consultando sugestão de Bezerreiro…</p>}
    {elegivel && sugestao.perfis.length === 1 && <p>{configurado ? "Bezerreiro sugerido para este sítio. Você pode trocar o lote." : "Há um Bezerreiro disponível neste sítio. Você pode escolher o lote."}</p>}
    {elegivel && sugestao.perfis.length > 1 && <p>Há mais de um Bezerreiro neste sítio. Escolha o lote de destino ou Sem lote.</p>}
    {configurado && <p>Ao salvar, entra no Bezerreiro sem programação alimentar.</p>}
  </div>;
}
