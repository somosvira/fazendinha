# Produto · Terrano

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A perspectiva de uso é única. A mesma pessoa pode registrar uma pesagem hoje, consultar a evolução do animal amanhã e comparar lotes no fechamento do mês. Organize a experiência pela tarefa, pelo sítio e pelo registro em questão. Perfis de acesso continuam determinando quais dados e ações cada pessoa pode usar.

## Product Purpose

O Fazendinha reúne os fatos da fazenda para que as pessoas possam diagnosticar a situação operacional, estudar relações entre dados e elaborar estratégias de gerenciamento. A qualidade dessa análise começa no lançamento. Uma pesagem precisa identificar o animal, a data, o valor e a unidade para que outra pessoa consiga interpretar a curva ou conferir o relatório depois.

O percurso também funciona no sentido inverso. Ao encontrar uma variação em um relatório, a pessoa deve conseguir entender o período, a população e a origem do resultado e, quando houver destino autorizado, abrir os registros correspondentes.

## Capabilities and Constraints

Financeiro, Estoque e Pecuária relacionam registros por vínculos identificáveis. Sítios e Contas/Acessos delimitam o que pode ser consultado ou alterado. Preserve unidade, data do fato, histórico, autoria e eventuais restrições à exibição de valores. Uma tarefa agendada, uma aplicação realizada, uma saída de estoque e um pagamento são fatos diferentes.

Para propor uma correlação, identifique quais registros se relacionam, por qual vínculo e em que período. Mostre cobertura parcial e origem estimada quando afetarem a leitura. Um campo vazio, um zero medido, um dado oculto por permissão e uma falha de consulta pedem respostas diferentes. As [referências por domínio](../docs/README.md#referências-por-domínio) ajudam a localizar as regras e a conferir sua implementação.

## Brand Commitments

A marca Terrano identifica uma experiência contínua entre áreas. Um mesmo gesto deve conservar seu significado ao sair do Rebanho e entrar no Estoque. Tipografia, cores, superfícies e critérios para escolher controles estão nos [princípios de design](DESIGN.md).

## Evidence on Hand

Na [lista de animais](src/pecuaria/rebanho/telas/ListaAnimais.tsx), a pessoa localiza e compara registros. Na [ficha individual](src/pecuaria/rebanho/telas/DetalheAnimal.tsx), acompanha um animal e consulta os fatos que explicam seu estado. As duas telas exemplificam como a mesma base de dados atende perguntas diferentes.

## Product Principles

1. **Começar pelo resultado que a pessoa busca.** Antes de acrescentar um campo, identificar quando seu valor passa a ser conhecido, qual decisão ele permite e onde será lido. Reaproveitar o contexto conhecido e tornar a correção acessível.
2. **Distribuir o trabalho por decisões.** Em um lançamento curto, manter os dados relacionados juntos. Dividir um processo quando uma escolha define o próximo conjunto de dados ou quando é preciso conferir consequências. Ao voltar, preservar o que já foi preenchido.
3. **Escolher a leitura pelo tipo de dado.** Priorizar tabelas ao comparar muitos registros de estoque, lotes, execuções de protocolos ou pesagens de uma ficha. Para a situação atual de um indivíduo, como o estado reprodutivo, reunir estado, referência temporal e ação em um cartão ou bloco contextual. Gráficos respondem a perguntas de evolução ou distribuição.
4. **Conservar significado ao aprofundar.** Manter o sítio, o período, os filtros e a unidade ao passar do resultado para a evidência. Mostrar estados por eixos independentes: uma mesma fêmea pode estar gestante e lactante. Oferecer explicação ou auditoria perto do dado a que se refere.
5. **Avaliar o percurso completo.** A pessoa deve conseguir registrar, reconhecer o que foi salvo, reencontrar o fato e usar seu resultado. Verificar esse percurso com dados plausíveis, inclusive quando faltam informações ou uma gravação precisa ser corrigida.
