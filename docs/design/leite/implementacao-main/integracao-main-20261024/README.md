# V5 integrada aos componentes da main

A apresentação reutiliza o padrão atual de Rebanho e Nutrição: `PageHeader`, `SubTabs`, `TabelaFinanceira`, primitivas `Table`, `SelectCampo`, `Button` e `SecaoRecolhivel`. Cores, divisórias, densidade e seleção vêm dos tokens Cooperativa e dos estilos compartilhados. Ordenhas preserva a escolha do tanque, origens históricas, rascunhos e confirmação de estoque separada.

As capturas mostram os componentes React com respostas ilustrativas de consulta, sem API operacional ou banco. Desktop e iframe de 390 px foram inspecionados; os cartões preservam as mesmas colunas e estados da tabela. Não são evidência de migrations aplicadas, homologação na fazenda ou deploy.

- [Produção no desktop](producao-desktop.png)
- [Produção em cartões no celular](producao-mobile.png)
- [Abas no celular](abas-mobile.png)

O comportamento daquela entrega foi registrado no [contrato de leite](https://github.com/somosvira/fazendinha/blob/4271f29952902fa1e4ccb30909b6c11afa35d607/docs/pecuaria/leite.md).
