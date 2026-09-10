# Gerenciamento de contas e parceiros financeiros

## Decisões de dados e auditoria

- Contas continuam usando `instituicao` e `identificacao`. Banco, agência, conta,
  dígito e tipo bancário não serão separados nesta entrega: ainda não há
  conciliação ou integração bancária que estabeleça quais desses campos são
  obrigatórios e a identificação atual também atende caixas, aplicações e
  dinheiro. A separação fica condicionada a esse contrato futuro e a uma
  migração dos valores existentes.
- Nome fantasia e endereço de parceiros não serão acrescentados ao schema nesta
  entrega. Nome/razão social, CPF/CNPJ, papel, telefone e e-mail já possuem
  persistência e formam o escopo completo do formulário.
- Operações, compromissos, transações e movimentos continuam referenciando o ID
  estável da conta ou do parceiro. Nenhuma edição ou desativação substitui ou
  remove essas relações.
- O nome apresentado no histórico continua sendo o nome corrente do cadastro.
  Portanto, uma correção de nome também passa a aparecer nas telas históricas.
  A autoria e os valores anterior/posterior da alteração ficam preservados em
  `AuditoriaFinanceira`; não será criado snapshot de apresentação nesta entrega.
- Não há exclusão física na API desses cadastros. Desativação é auditada como
  ação própria, remove o item das opções de novas operações e mantém sua
  identificação nas relações existentes. Reativação volta a disponibilizá-lo.

## Navegação da interface

O cadastro abre em painel lateral e é representado na query string da rota
`/financeiro/configuracoes`: `aba`, `conta`/`parceiro` ou `nova`. Isso preserva
a aba, permite recarregar o detalhe e integra voltar/avançar sem introduzir um
segundo roteador no aplicativo.
