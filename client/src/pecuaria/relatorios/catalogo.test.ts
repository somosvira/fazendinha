import{expect,it}from'vitest';
import{fontesRelatorio,relatoriosDisponiveis,formatarCelula,csvPersonalizado,normalizarModelo}from'./catalogo';
it('todo relatório navegável possui fontes e variáveis válidas no builder',()=>{for(const r of relatoriosDisponiveis){expect(r.fontes.length).toBeGreaterThan(0);for(const id of r.fontes){const f=fontesRelatorio[id];expect(f).toBeTruthy();expect(new Set(f.campos.map(c=>c.id)).size).toBe(f.campos.length);expect(f.padrao.every(c=>f.campos.some(v=>v.id===c))).toBe(true)}}});
it('preserva desconhecido, falso e zero e informa unidades',()=>{expect(formatarCelula(null)).toBe('Não informado');expect(formatarCelula(false)).toBe('Não');expect(formatarCelula(0,'L')).toBe('0 L')});
it('neutraliza fórmulas e escapa aspas no CSV',()=>{const csv=csvPersonalizado([{id:'x',nome:'Matriz',grupo:'Animal',ajuda:''}],[{x:'=SUM(1;2) "teste"'}]);expect(csv).toContain("'=SUM");expect(csv).toContain('""teste""')});
it('remove campos obsoletos e rejeita fonte ou modelo inválido',()=>{expect(normalizarModelo({nome:'Teste',fonte:'partos',campos:['matriz','removido','matriz']})).toMatchObject({campos:['matriz']});expect(normalizarModelo({nome:'x',fonte:'sql',campos:['x']})).toBeNull();expect(normalizarModelo({nome:'x',fonte:'partos',campos:['removido']})).toBeNull()});
it('catálogo operacional publica 27 fontes sem variáveis órfãs',()=>{const r=relatoriosDisponiveis.find(r=>r.id==='catalogo')!;expect(r.fontes).toHaveLength(27);expect(new Set(r.fontes).size).toBe(27);for(const id of r.fontes){const f=fontesRelatorio[id];expect(f.padrao.length).toBeGreaterThan(0);expect(f.campos.every(c=>c.nome&&c.grupo&&c.ajuda)).toBe(true)}});

it('formata datas civis e instantes preservando números e unidades',()=>{expect(formatarCelula('2026-10-27')).toBe('27/10/2026');expect(formatarCelula('2026-10-27T12:00:00.000Z')).toContain('09:00');expect(formatarCelula('123.45','L')).toBe('123.45 L')});

it('valor decimal monetário usa a formatação brasileira sem recalcular o custo',()=>{expect(formatarCelula('180.00','R$').replaceAll('\u00a0',' ')).toBe('R$ 180,00')});
