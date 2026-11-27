# Manual do aplicativo por eixos

Abra [index.html](index.html) diretamente no navegador. O arquivo contém os capítulos, estilos, diagramas e interações, sem CDN, API ou banco. Busca, navegação, exemplo de estados e impressão funcionam localmente.

## Capítulos

| Grupo | Capítulo |
|---|---|
| Introdução | [Visão geral](01-visao-geral.md) |
| Financeiro | [Operações](02-financeiro-operacoes.md) · [Estoque](03-financeiro-estoque.md) |
| Pecuária | [Rebanho](04-pecuaria-rebanho.md) · [Reprodução](05-pecuaria-reproducao.md) · [Produção](06-pecuaria-producao.md) · [Sanidade](07-pecuaria-sanidade.md) · [Nutrição](08-pecuaria-nutricao.md) |
| Integração | [Conectar e avaliar](09-integracao-e-lacunas.md) |


## Regenerar

Edite o Markdown e execute `scripts/documentacao/gerar-guia.mjs` com Node 22+ e **marked 17** disponível no caminho de módulos. Não é dependência do aplicativo. No runtime de artefatos do Codex, obtenha os caminhos de Node/pacotes por `load_workspace_dependencies` e use:

```bash
NODE_PATH=/caminho/para/node_modules /caminho/para/node scripts/documentacao/gerar-guia.mjs
```

Em outro ambiente, instale marked 17 em um diretório de ferramentas e aponte `NODE_PATH` para seu `node_modules`. O gerador não conecta ao banco, não inicia o app e não altera a documentação de origem. O HTML é determinístico para as mesmas fontes e versão da biblioteca. O diagrama do percurso do leite tem descrição textual acessível.

## Conferir

Verifique links relativos/âncoras, duplicação de IDs e sintaxe do script; abra desktop e celular; exercite busca, navegação e os momentos do exemplo. Na impressão, todos os capítulos permanecem legíveis. Essa validação é do documento, não da aplicação. Não execute seed, migrations ou roteiros de homologação apenas para regenerar o manual.
