import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatarDataBR } from '../lib/rotulos';
import { formatarLitros } from './modelo';
import { situacaoOrdenha } from './visuais-leite';
import type { RegistroOrdenhaConsulta } from './parcelas-types';
import './tabela-ordenhas-dia.css';

export function TabelaOrdenhasPorDia({ itens, abrir, podeLancar }: { itens: RegistroOrdenhaConsulta[]; abrir: (registro: RegistroOrdenhaConsulta) => void; podeLancar: boolean }) {
  const grupos = new Map<string, RegistroOrdenhaConsulta[]>();
  for (const registro of [...itens].sort((a, b) => b.dataOperacional.localeCompare(a.dataOperacional) || a.ordem - b.ordem)) {
    const grupo = grupos.get(registro.dataOperacional) ?? [];
    grupo.push(registro);
    grupos.set(registro.dataOperacional, grupo);
  }
  return <Table aria-label="Ordenhas registradas" className="ordenhas-por-dia" containerLabel="Ordenhas agrupadas por dia">
    <TableHeader><TableRow>{['Ordenha', 'Comercial', 'Não comercial', 'Colostro', 'Total', 'Situação', 'Ação'].map((titulo, i) => <TableHead key={titulo} className={i > 0 && i < 5 ? 'numero' : ''}>{titulo}</TableHead>)}</TableRow></TableHeader>
    {[...grupos].map(([data, registros]) => <TableBody key={data} aria-label={`Ordenhas de ${formatarDataBR(data)}`}>
      <TableRow className="ordenhas-dia-titulo"><TableCell colSpan={7}><strong>{formatarDataBR(data)}</strong><span>{registros.length} {registros.length === 1 ? 'ordenha' : 'ordenhas'} nesta página</span></TableCell></TableRow>
      {registros.map(r => <TableRow key={r.id} className="ordenha-linha" onClick={() => abrir(r)}>
        <TableCell><strong>{r.nome}</strong></TableCell>
        {['COMERCIAL', 'NAO_COMERCIAL', 'COLOSTRO'].map(n => { const litros = r.porNatureza.find(p => p.natureza === n)?.litros; return <TableCell key={n} className="numero">{litros == null ? '—' : formatarLitros(litros)}</TableCell>; })}
        <TableCell className="numero"><strong>{r.litros == null ? 'Não aferido' : formatarLitros(r.litros)}</strong></TableCell>
        <TableCell><Badge variant="outline">{situacaoOrdenha(r)}</Badge></TableCell>
        <TableCell><Button size="sm" variant="outline" aria-label={`${r.situacao === 'CONFIRMADA' || !podeLancar ? 'Consultar' : 'Editar registro'} ${r.nome} de ${formatarDataBR(data)}`} onClick={e => { e.stopPropagation(); abrir(r); }}>{r.situacao === 'CONFIRMADA' || !podeLancar ? 'Consultar' : 'Editar registro'}</Button></TableCell>
      </TableRow>)}
    </TableBody>)}
  </Table>;
}
