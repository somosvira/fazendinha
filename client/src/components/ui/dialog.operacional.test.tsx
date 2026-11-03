// @vitest-environment jsdom
import{afterEach,it,expect}from'vitest';
import{render,screen,cleanup,waitFor}from'@testing-library/react';
import{Dialog,DialogContent,DialogTitle}from'./dialog';
import{AjudaCampo}from'../Dica';
afterEach(cleanup);
it('inicia modal operacional no título sem abrir ajuda automaticamente',async()=>{
 render(<div data-design-operacional=""><Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Nova receita</DialogTitle><AjudaCampo texto="Explicação" rotulo="Ajuda da receita"/><input aria-label="Nome"/></DialogContent></Dialog></div>);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Nova receita'})));
 expect(screen.queryByText('Explicação')).toBeNull();
});
it('mantém foco explícito solicitado pelo fluxo',async()=>{
 render(<div data-design-operacional=""><Dialog open><DialogContent aria-describedby={undefined} onOpenAutoFocus={e=>{e.preventDefault();document.getElementById('alvo')?.focus()}}><DialogTitle>Buscar</DialogTitle><input id="alvo" aria-label="Consulta"/></DialogContent></Dialog></div>);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByLabelText('Consulta')));
});
it('não altera a abertura dos diálogos sem escopo operacional',async()=>{
 render(<Dialog open><DialogContent aria-describedby={undefined}><DialogTitle>Financeiro</DialogTitle><input aria-label="Valor"/></DialogContent></Dialog>);
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByLabelText('Valor')));
});
