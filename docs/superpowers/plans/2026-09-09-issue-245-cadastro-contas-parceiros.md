# Plano — Issue #245: completar criação e edição de contas e parceiros

Issue: https://github.com/somosvira/fazendinha/issues/245
Branch sugerida: `feat/245-cadastro-contas-parceiros` (a partir de `main`).
Commits em PT-BR no formato `feat(financeiro): ...` / `test(financeiro): ...`.

## 0. Contexto que o executor precisa saber antes de tocar em código

- Os modelos reais são **`ContaFinanceira`** e **`Parceiro`** (`server/prisma/schema.prisma`, ~L150 e ~L344). Enums: `TipoContaFinanceira` (BANCO, CAIXA, APLICACAO, DINHEIRO) e `TipoParceiro` (CLIENTE, FORNECEDOR, AMBOS, FUNCIONARIO, PROPRIETARIO, OUTRO). **Nenhuma mudança de schema/migration é necessária.** Não inventar campos.
- `ContaFinanceira` tem `@@unique([propriedadeId, nome])`. `Parceiro` tem `@@unique([documento])` (global) e **não tem `propriedadeId`** — parceiro é compartilhado entre propriedades de propósito.
- Não existe DELETE de conta nem de parceiro e **não deve existir**. O modelo é desativar (`ativo: false`). Referências: `MovimentoConta.contaId` (obrigatório), `Operacao.parceiroId`, `CompromissoFinanceiro.parceiroId`, `TransacaoFinanceira.parceiroId` (opcionais).
- Rotas atuais em `server/src/routes/financeiro.ts` (L56-83): `GET/POST /financeiro/contas`, `PATCH /financeiro/contas/:id`, `GET/POST /financeiro/parceiros`, `PATCH /financeiro/parceiros/:id`. `GET /financeiro/configuracoes` (L40) devolve contas e parceiros **incluindo inativos**; quem filtra é o cliente.
- Services: `server/src/services/financeiro/contas.ts` e `parceiros.ts`. Ambos já auditam via `auditar()` de `regras.ts`. Erros de domínio usam `FinanceiroError(code, message)`; a função `falha(c, erro)` na rota mapeia `NAO_ENCONTRADO→404`, `VALIDACAO→422`, demais→409, e devolve `{ error, code }`.
- Tela: `client/src/financeiro/ConfiguracoesFinanceiras.tsx` (38 linhas, estilo de linha única). Fetch em `client/src/financeiro/novo-api.ts` (`criarConta`, `atualizarConta`, `criarParceiro`, `atualizarParceiro`, todos com `input: unknown`). Kit de UI em `client/src/financeiro/financeiro-ui.tsx` (`Button`, `Panel`, `Pill`, `ErrorBox`, `PageHeader`, `TabelaFinanceira`, `brl`, `dataBR`, `hoje`).
- Componentes prontos para reaproveitar: `client/src/components/ui/sheet.tsx` (Sheet Radix, `side="right"`, largura padrão `sm:max-w-sm` — estreito, sobrescrever via `className`), `client/src/components/ConfirmDialog.tsx` (`open, title, message, confirmLabel, cancelLabel, tone: "neutral"|"danger", onConfirm, onCancel`; exemplo de uso em `FormOperacao.tsx` L237-246).
- Testes: server usa Vitest com `vi.mock("../../db.js", ...)` (ver `services/financeiro/rascunhos.test.ts` como modelo). Client roda Vitest com `environment: "node"` por padrão; testes de componente precisam do cabeçalho `// @vitest-environment jsdom` e usam `@testing-library/react` (ver `FormOperacao.test.tsx`). Rodar com `pnpm --filter rionovo-server run test` e `pnpm --filter rionovo-client run test`. Sem `server/.env`, exportar `DATABASE_URL=postgres://x` dummy.
- Regras do CLAUDE.md que se aplicam: imports relativos no server terminam em `.js`; no client sem extensão; toda request do client passa por `comPropriedade()` (já embutido no helper `req` de `novo-api.ts`); não criar `.md` novos; não hardcodar hex em CSS.

## 1. Decisões de produto já tomadas (não reabrir)

1. **Sem exclusão física.** Desativar é a única forma de "remover". Sem endpoint DELETE.
2. **Saldo e data de abertura são editáveis somente enquanto a conta não tem movimentos.** Depois disso, o servidor recusa com mensagem clara e a UI mostra os campos desabilitados com aviso. `tipo`, `nome`, `instituicao`, `identificacao`, `incluirNoSaldoGeral` são sempre editáveis.
3. **Identificação da conta continua um texto livre.** Não criar campos estruturados de banco/agência/dígito.
4. **Nome fantasia e endereço de parceiro ficam fora.** Não mexer no schema.
5. **Sem deep-link para o item selecionado.** A sub-aba (contas/parceiros) e o painel aberto vivem em estado React. Não tocar em `client/src/router.ts`.
6. **Parceiro inativo passa a ser bloqueado também no servidor** (hoje só o cliente filtra).
7. **Colisão de unicidade vira erro amigável no campo** (nome de conta duplicado na propriedade; documento de parceiro duplicado).

## 2. Backend

### 2.1 `server/src/services/financeiro/schemas.ts`

Adicionar (e exportar) os schemas de PATCH, removendo as definições inline das linhas 36-37 de `routes/financeiro.ts`:

```ts
export const patchContaSchema = contaSchema
  .omit({ propriedadeId: true })
  .partial()
  .extend({ ativo: z.boolean().optional() });

export const patchParceiroSchema = parceiroSchema
  .partial()
  .extend({ ativo: z.boolean().optional() });
```

Observações:
- `contaSchema.saldoAbertura` tem `.default(0)` e `incluirNoSaldoGeral` tem `.default(true)`. Ao aplicar `.partial()` os defaults continuam sendo aplicados quando a chave está ausente? **Não** — em Zod, `.partial()` torna o campo `optional()` por fora do default, então chave ausente vira `undefined`. Confirmar com um teste em `schemas.test.ts` que `patchContaSchema.parse({ nome: "X" })` **não** injeta `saldoAbertura: 0` nem `incluirNoSaldoGeral: true`. Se injetar, redefinir `patchContaSchema` explicitamente campo a campo com `.optional()` sem default. Isso é crítico: um PATCH só de `ativo` não pode zerar o saldo de abertura.
- Adicionar validação de documento no `parceiroSchema`: transformar para só dígitos e exigir 11 (CPF) ou 14 (CNPJ) dígitos **quando informado**; string vazia vira `null`. Implementar como função pura `normalizarDocumento(valor): string | null` em `schemas.ts` (ou `regras.ts`) e usar via `.transform()` + `.refine()`. Não validar dígito verificador no servidor (o cliente faz); no servidor só formato.
- `email`: aceitar `""` como `null` (o formulário manda string vazia). Usar `z.preprocess((v) => v === "" ? null : v, z.string().email().nullable().optional())`. Mesmo tratamento para `telefone`, `instituicao`, `identificacao`, `documento`.

### 2.2 `server/src/services/financeiro/regras.ts`

1. Adicionar campo opcional `campo` ao `FinanceiroError` para o front saber em qual input mostrar a mensagem:

```ts
export class FinanceiroError extends Error {
  constructor(public code: ..., message: string, public campo?: string) { super(message); }
}
```

2. Adicionar `exigirParceiroAtivo`, espelhando `exigirContaAtiva`:

```ts
export async function exigirParceiroAtivo(db: DbFinanceiro, parceiroId: number) {
  const parceiro = await db.parceiro.findFirst({ where: { id: parceiroId, ativo: true } });
  if (!parceiro) throw new FinanceiroError("NAO_ENCONTRADO", "Parceiro não encontrado ou inativo", "parceiroId");
  return parceiro;
}
```

3. Adicionar helper para traduzir violação de unicidade do Prisma:

```ts
export function traduzirConflitoUnico(erro: unknown, mensagens: Record<string, string>): never {
  if (erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002") {
    const alvos = (erro.meta?.target as string[] | undefined) ?? [];
    for (const [campo, mensagem] of Object.entries(mensagens)) {
      if (alvos.includes(campo)) throw new FinanceiroError("CONFLITO", mensagem, campo);
    }
  }
  throw erro;
}
```

### 2.3 `server/src/services/financeiro/parceiros.ts`

- Tipar `atualizarParceiro(id, input: z.infer<typeof patchParceiroSchema>, usuarioId?)` em vez de `Record<string, unknown>`.
- Envolver `create` e `update` em `try/catch` chamando `traduzirConflitoUnico(e, { documento: "Já existe um parceiro com este CPF/CNPJ" })`.
- Em `listarParceiros`, incluir contagem de referências para a UI explicar o impacto de desativar:

```ts
return prisma.parceiro.findMany({
  where: ..., orderBy: { nome: "asc" },
  include: { _count: { select: { operacoes: true, compromissos: true, transacoes: true } } },
}).then((lista) => lista.map(({ _count, ...p }) => ({ ...p, referencias: _count.operacoes + _count.compromissos + _count.transacoes })));
```

### 2.4 `server/src/services/financeiro/contas.ts`

- Em `listarContas`, além de `saldoAtual`, devolver `temMovimentos: movimentos.length > 0` (os movimentos já vêm carregados; custo zero).
- Tipar `atualizarConta(id, propriedadeId, input: z.infer<typeof patchContaSchema>, usuarioId?)`.
- Dentro da transação de `atualizarConta`, antes do `update`:

```ts
const mexeAbertura = ("saldoAbertura" in input && input.saldoAbertura !== undefined && !new Prisma.Decimal(input.saldoAbertura).equals(anterior.saldoAbertura))
  || ("dataSaldoAbertura" in input && input.dataSaldoAbertura !== undefined && input.dataSaldoAbertura.getTime() !== anterior.dataSaldoAbertura.getTime());
if (mexeAbertura) {
  const movimentos = await tx.movimentoConta.count({ where: { contaId: id } });
  if (movimentos > 0) throw new FinanceiroError("VALIDACAO", "Saldo e data de abertura não podem ser alterados em conta que já possui movimentos", "saldoAbertura");
}
```

- Envolver `create` e `update` com `traduzirConflitoUnico(e, { nome: "Já existe uma conta com este nome nesta propriedade" })`.

### 2.5 `server/src/services/financeiro/operacoes.ts`

Chamar `await exigirParceiroAtivo(tx, input.parceiroId)` sempre que `input.parceiroId` estiver definido, nos pontos onde uma `Operacao` ou `TransacaoFinanceira` é criada a partir de input do usuário:
- na função que constrói a operação (o bloco que grava `parceiroId: input.parceiroId` por volta das L115 e L146, dentro de `confirmarRascunhoOperacao` / `criarOperacao`);
- em `criarTransacaoAvulsa` (L228, o bloco que grava `parceiroId: input.parceiroId` na L49).

**Não** chamar em `liquidarCompromisso` nem em estornos: eles herdam `parceiroId` de registros existentes e precisam funcionar mesmo com parceiro inativo (é exatamente a preservação do histórico).

### 2.6 `server/src/routes/financeiro.ts`

- Trocar as definições inline de `patchContaSchema`/`patchParceiroSchema` por import de `schemas.js`.
- Em `falha()`, incluir `campo` na resposta: `c.json({ error: erro.message, code: erro.code, campo: erro.campo }, status)`.
- Nenhuma rota nova. `GET /financeiro/contas/:id` e `/parceiros/:id` **não** são necessários: o painel de edição usa o item já carregado por `/financeiro/configuracoes`.

### 2.7 Testes de backend (novos)

`server/src/services/financeiro/contas.test.ts` — mockar `../../db.js` como em `rascunhos.test.ts` (`$transaction` chamando o callback com um `tx` fake). Casos:
1. `atualizarConta` com só `{ ativo: false }` chama `update` com `data` contendo apenas `ativo` (garante que nada é zerado).
2. `atualizarConta` alterando `saldoAbertura` em conta com `movimentoConta.count` = 3 lança `FinanceiroError` `VALIDACAO` e não chama `update`.
3. Mesmo caso com `count` = 0 chama `update`.
4. `atualizarConta` em `propriedadeId` diferente lança `NAO_ENCONTRADO`.
5. `criarConta` recebendo `P2002` com `target: ["propriedadeId","nome"]` lança `CONFLITO` com `campo: "nome"`.
6. `listarContas` devolve `temMovimentos` e `saldoAtual` corretos para uma conta com ENTRADA 100 e SAIDA 30 sobre abertura 50 (esperado `120`).

`server/src/services/financeiro/parceiros.test.ts`:
1. `criarParceiro` traduz `P2002` em `documento` para `CONFLITO` com `campo: "documento"`.
2. `atualizarParceiro` com `{ ativo: false }` audita `antes`/`depois` e chama `update` só com `ativo`.
3. `listarParceiros` agrega `referencias` a partir de `_count`.

`server/src/services/financeiro/regras.test.ts` (novo): `exigirParceiroAtivo` lança quando `findFirst` devolve `null`; `traduzirConflitoUnico` relança erros que não são P2002.

`server/src/services/financeiro/schemas.test.ts` (ampliar):
1. `patchContaSchema.parse({ nome: "Caixa" })` não contém `saldoAbertura` nem `incluirNoSaldoGeral`.
2. `patchContaSchema` aceita `tipo`, `saldoAbertura`, `dataSaldoAbertura`.
3. `parceiroSchema` normaliza `"123.456.789-09"` para `"12345678909"`, aceita 14 dígitos, rejeita 10 dígitos, transforma `""` em `null`.
4. `parceiroSchema` transforma `email: ""` em `null` e rejeita `email: "x"`.

## 3. Frontend

### 3.1 `client/src/financeiro/novo-api.ts`

- Tipar `Parceiro.tipo` como union `"CLIENTE" | "FORNECEDOR" | "AMBOS" | "FUNCIONARIO" | "PROPRIETARIO" | "OUTRO"` e adicionar `referencias: number`. Adicionar `temMovimentos: boolean` em `Conta`. Atualizar os fixtures nos testes existentes que constroem `Conta`/`Parceiro` (`FormOperacao.test.tsx`, `OperacaoFinanceiraDetalhe.test.tsx`, `OperacoesFinanceiras.test.tsx`, `CompromissosFinanceiros.test.tsx`, `responsivo.test.tsx`) para que o `tsc` do build passe.
- Exportar tipos de payload e tipar as quatro funções:

```ts
export type ContaInput = { nome: string; tipo: Conta["tipo"]; instituicao?: string | null; identificacao?: string | null; saldoAbertura: number; dataSaldoAbertura: string; incluirNoSaldoGeral: boolean };
export type ContaPatch = Partial<ContaInput> & { ativo?: boolean };
export type ParceiroInput = { nome: string; documento?: string | null; tipo: Parceiro["tipo"]; telefone?: string | null; email?: string | null };
export type ParceiroPatch = Partial<ParceiroInput> & { ativo?: boolean };
```

- Trocar o `throw new Error(...)` do helper `req` por uma classe exportada `ApiError extends Error { code?: string; campo?: string }` que carrega `corpo.code` e `corpo.campo`. Manter `message` igual para não quebrar quem só lê `e.message`.

### 3.2 `client/src/financeiro/lib/validacao.ts` (novo, puro, testado)

Funções:
- `somenteDigitos(valor: string): string`
- `validarCpf(digitos: string): boolean` e `validarCnpj(digitos: string): boolean` (com dígitos verificadores; rejeitar sequências repetidas como `00000000000`).
- `validarDocumento(valor: string): string | null` — devolve mensagem de erro ou `null`; vazio é válido.
- `formatarDocumento(digitos: string): string` — `000.000.000-00` / `00.000.000/0000-00` para exibição na tabela.
- `validarEmail(valor: string): string | null` — vazio válido; senão regex simples `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
- `validarConta(form): Record<string, string>` e `validarParceiro(form): Record<string, string>` — devolvem erros por campo (`nome` mínimo 2, `saldoAbertura` numérico, `dataSaldoAbertura` obrigatória, etc.). Estes dois são a única fonte de validação síncrona do formulário.

Teste `validacao.test.ts`: CPF válido/inválido, CNPJ válido/inválido, formatação, e-mail, e `validarConta` acusando nome curto e saldo não numérico.

### 3.3 `client/src/financeiro/PainelCadastro.tsx` (novo)

Wrapper fino sobre `Sheet` para os dois formulários, para não repetir cabeçalho/rodapé:

```tsx
export function PainelCadastro({ aberto, titulo, eyebrow, onFechar, children, rodape }: {...}) {
  return <Sheet open={aberto} onOpenChange={(v) => { if (!v) onFechar(); }}>
    <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
      <SheetHeader className="border-b border-border p-5"><div className="eyebrow">{eyebrow}</div><SheetTitle className="font-serif text-2xl">{titulo}</SheetTitle><SheetDescription className="sr-only">{titulo}</SheetDescription></SheetHeader>
      <div className="p-5">{children}</div>
      <SheetFooter className="sticky bottom-0 border-t border-border bg-card p-5">{rodape}</SheetFooter>
    </SheetContent>
  </Sheet>;
}
```

`SheetDescription` é obrigatório para o Radix não logar warning de acessibilidade. Fechar com Escape e clique fora deve **descartar** sem confirmar (formulários curtos; não há rascunho aqui).

### 3.4 `client/src/financeiro/CampoFormulario.tsx` (novo, pequeno)

Um `<label>` com título, input/select passado como children, e `erro?: string` renderizado abaixo em `text-xs text-red-700` com `aria-describedby`/`aria-invalid` ligados. Usar o mesmo estilo de input do formulário atual (`mt-1.5 w-full rounded-lg border border-border p-2.5 font-normal`). Se preferir, colocar no próprio `PainelCadastro.tsx` como export secundário.

### 3.5 `client/src/financeiro/FormConta.tsx` (novo)

Props: `{ conta: Conta | null; onSalvo: () => Promise<void> | void; onFechar: () => void }`. `conta === null` é criação.

Estado local, um `useState` por campo, inicializado de `conta` quando existe:
- `nome` (text, obrigatório)
- `tipo` (select com os 4 valores; labels "Banco", "Caixa", "Aplicação", "Dinheiro")
- `instituicao` (text, placeholder "Ex.: Sicoob, Banco do Brasil")
- `identificacao` (text, placeholder "Ex.: Ag. 1234 · C/C 56789-0")
- `saldoAbertura` (number step 0.01)
- `dataSaldoAbertura` (date, default `hoje()` na criação)
- `incluirNoSaldoGeral` (checkbox, default marcado, texto de apoio "Contas fora do saldo geral continuam com extrato próprio")

Regras de UI:
- Se `conta?.temMovimentos`, `saldoAbertura` e `dataSaldoAbertura` ficam `disabled` com aviso inline "Esta conta já possui movimentos; saldo e data de abertura não podem mais ser alterados."
- `submit`: rodar `validarConta`; se houver erros, setar `erros` e não chamar API. Senão, `criarConta(payload)` ou `atualizarConta(conta.id, payload)` — no PATCH, enviar **apenas** campos alterados em relação a `conta` (diff simples), e nunca enviar `saldoAbertura`/`dataSaldoAbertura` quando `temMovimentos`.
- `catch (e)`: se `e instanceof ApiError && e.campo`, setar `erros[e.campo] = e.message`; senão setar `erroGeral` exibido com `ErrorBox` no topo do formulário.
- Estado `salvando` desabilita o botão e mostra "Salvando…".
- Rodapé: `Button secondary` "Cancelar" e `Button type="submit"` "Salvar conta" / "Criar conta".

### 3.6 `client/src/financeiro/FormParceiro.tsx` (novo)

Props iguais ao `FormConta` (`parceiro: Parceiro | null`). Campos:
- `nome` (text, obrigatório, label "Nome / razão social")
- `documento` (text, label "CPF/CNPJ", `inputMode="numeric"`; ao `blur` aplicar `formatarDocumento` se válido)
- `tipo` (select com os 6 valores; labels: Fornecedor, Cliente, Cliente e fornecedor, Funcionário, Proprietário, Outro)
- `telefone` (tel)
- `email` (email)

Mesmas regras de submit/erro/diff do `FormConta`. Enviar `documento` já em dígitos (`somenteDigitos`) e `null` quando vazio.

### 3.7 `client/src/financeiro/ConfiguracoesFinanceiras.tsx` (reescrever)

Manter: `PaginaFinanceira`, `PageHeader`, as duas sub-abas, `TabelaFinanceira`, `classeLinha` com `opacity-55` para inativos, `carregar()`.

Remover: o `Panel` com formulário inline, os estados `nome/tipo/saldo/documento`, a função `adicionar`.

Novo estado:
```ts
type Painel = { modo: "novo" } | { modo: "editar"; id: number } | null;
const [painel, setPainel] = useState<Painel>(null);
const [confirmando, setConfirmando] = useState<{ tipo: "conta"; item: Conta } | { tipo: "parceiro"; item: Parceiro } | null>(null);
```

Comportamentos:
1. Botão do header "Nova conta"/"Novo parceiro" → `setPainel({ modo: "novo" })`.
2. Passar `onAbrir={(item) => setPainel({ modo: "editar", id: item.id })}` na `TabelaFinanceira` das duas abas (isso já dá clique na linha e Enter/Espaço no teclado, sem mexer no componente).
3. Nova coluna "Ações" (última, `alinhamento: "direita"`, `larguraMinima: 120`, `ocultarNoCartao: false`) com dois botões com ícones `lucide-react`: `Pencil` (aria-label "Editar {nome}") → mesmo `setPainel` acima, e `Power`/`PowerOff` (aria-label "Desativar {nome}" / "Reativar {nome}"). **Ambos com `e.stopPropagation()`** no `onClick` para não disparar o `onAbrir` da linha. Mover para cá o botão texto "Desativar/Reativar" que hoje vive na coluna Situação; a coluna Situação passa a mostrar só o `Pill`.
4. Desativar: abre `ConfirmDialog` com `tone="danger"`, `title="Desativar {nome}?"`, `confirmLabel="Desativar"`, `cancelLabel="Manter ativa"`. Mensagem:
   - conta: "A conta deixa de aparecer em novas operações e transferências. O extrato e todos os movimentos continuam disponíveis. Você pode reativar quando quiser."
   - parceiro: "{nome} deixa de aparecer em novas operações. As {referencias} operações, compromissos e transações já registradas continuam ligadas a este cadastro." (quando `referencias === 0`, usar "Nenhuma operação está ligada a este cadastro.")
   No `onConfirm`: `await atualizarConta(id, { ativo: false })` / `atualizarParceiro`, fechar o diálogo, `await carregar()`. Erro cai no `ErrorBox` da página.
5. Reativar **não** pede confirmação (é reversível e sem impacto): chama o PATCH direto e recarrega.
6. Painel: renderizar `PainelCadastro` com `FormConta` ou `FormParceiro` conforme `aba`, passando `conta={config.contas.find(c => c.id === painel.id) ?? null}` (idem parceiro). `onSalvo` = `async () => { setPainel(null); await carregar(); }`. A sub-aba ativa não muda ao salvar (critério "sem perder o contexto").
7. Ao trocar de sub-aba, fechar painel e diálogo (`setPainel(null); setConfirmando(null)`).
8. Na coluna Documento da tabela de parceiros, exibir `formatarDocumento(p.documento)`; na coluna Papel, usar um mapa de labels em vez de `replaceAll("_", " ")`. Na coluna Tipo das contas, usar labels "Banco/Caixa/Aplicação/Dinheiro".

Acessibilidade mínima: linha da tabela continua sem `role="button"` (há teste em `responsivo.test.tsx` que garante isso); ícones com `aria-label`; `Sheet` já cuida de foco.

### 3.8 Ajuste lateral em `client/src/financeiro/ContasFinanceiras.tsx`

Uma linha: os três cards de conta (`config.contas.slice(0, 3)`) e a auto-seleção inicial (`cfg.contas[0]`) devem considerar só `c.ativo`. É o único toque fora da tela de configuração; faz parte do critério "inativos não aparecem como opção".

### 3.9 Testes de frontend

`client/src/financeiro/lib/validacao.test.ts` — ver 3.2.

`client/src/financeiro/ConfiguracoesFinanceiras.test.tsx` (novo, `// @vitest-environment jsdom`). Mockar `./novo-api` com `vi.mock` expondo `obterConfiguracoesFinanceiras`, `criarConta`, `atualizarConta`, `criarParceiro`, `atualizarParceiro` como `vi.fn()`. Fixture com 1 conta ativa com `temMovimentos: true`, 1 conta inativa sem movimentos, 1 parceiro ativo com `referencias: 2`. Casos:
1. Clicar em "Nova conta" abre um `dialog` com os campos Nome, Tipo, Instituição, Identificação, Saldo de abertura, Data do saldo de abertura e a checkbox de saldo geral. Preencher e enviar chama `criarConta` com `dataSaldoAbertura` e `incluirNoSaldoGeral` vindos do formulário (não hardcoded).
2. Clicar no botão "Editar {nome}" da conta com movimentos abre o painel com os valores atuais preenchidos e os inputs de saldo/data `disabled`. Alterar só o nome e salvar chama `atualizarConta(id, { nome })` sem outros campos.
3. Clicar na linha (o `<tr>`) do parceiro abre o painel de parceiro com nome, documento, papel, telefone e e-mail.
4. Na aba parceiros, botão "Desativar {nome}" abre `ConfirmDialog` contendo o texto com o número de referências; confirmar chama `atualizarParceiro(id, { ativo: false })` e `obterConfiguracoesFinanceiras` é chamado de novo.
5. Clicar em "Reativar {nome}" na conta inativa chama `atualizarConta(id, { ativo: true })` sem abrir diálogo.
6. Submeter parceiro com e-mail "abc" mostra mensagem junto ao campo e não chama `criarParceiro`.
7. `criarParceiro` rejeitando com `ApiError` de `campo: "documento"` faz a mensagem aparecer abaixo do campo documento.
8. Clicar no ícone de editar **não** dispara duas aberturas (o `stopPropagation` funciona): `screen.getAllByRole("dialog")` tem tamanho 1.

`client/src/financeiro/responsivo.test.tsx`: só ajustar fixtures se o tipo mudar; comportamento intacto.

## 4. Ordem de execução sugerida

1. Backend schemas + regras + services + rota (`2.1`→`2.6`), depois testes de backend (`2.7`). Rodar `pnpm --filter rionovo-server run test` e `pnpm --filter rionovo-server exec tsc --noEmit`.
2. `novo-api.ts` + `validacao.ts` + testes puros (`3.1`, `3.2`).
3. Componentes novos (`3.3`→`3.6`), depois reescrita da tela (`3.7`) e ajuste em `ContasFinanceiras` (`3.8`).
4. Testes de tela (`3.9`). Rodar `pnpm --filter rionovo-client run test` e `pnpm build`.
5. Verificação manual com `pnpm dev`: criar conta com todos os campos, editar, tentar mudar saldo de conta com movimentos (esperar 422 com mensagem no campo), desativar com confirmação, reativar, criar parceiro com CPF duplicado (esperar mensagem no campo), conferir que conta/parceiro inativos sumiram do `FormOperacao` e da transferência.

## 5. Fora de escopo (não fazer nesta entrega)

- Campos bancários estruturados (banco, agência, conta, dígito).
- Nome fantasia e endereço de parceiro.
- URL/deep-link para item selecionado ou sub-aba.
- Endpoints `GET /contas/:id` e `GET /parceiros/:id`.
- Qualquer DELETE.
- Mudanças em `router.ts`, `Shell.tsx`, `AppSidebar.tsx`.
