# Proposta — builder e atendimento de protocolos por exceção

Estado em 23/10/2026: as correções C1–C6 foram implementadas localmente no mockup, cadastros e pontos de integração operacional existentes. A migration aditiva `20261023100000_builder_finalidade_metadados` está aplicada somente no PostgreSQL local `fazendinha_seedatev3`, preservando as contagens existentes e o manifesto da seed. O [contrato vigente](protocolos-exames.md#cadastro-de-modelos-finalidade-parâmetros-e-compatibilidade) incorpora as regras concluídas. Os pacotes amplos de atendimento por momento, envelope v2, exceções transacionais e emissão abaixo continuam como proposta; não são comprovados pela correção do cadastro. O código local contém alterações de outras frentes, preservadas nesta execução; não há entrega remota ou homologação de campo implícita.

[Cadastro de modelos / builder](artefatos/protocolos/atendimento-por-excecao/templates.html) · [Mockup de atendimento](artefatos/protocolos/atendimento-por-excecao/index.html) · [Contrato vigente](protocolos-exames.md) · [Referência visual aprovada](artefatos/protocolos/mockup-main/index.html)

## Resultado esperado

O usuário configura uma versão de protocolo sanitário ou reprodutivo com momentos, ações e parâmetros. Ao atender um momento, todos os animais pendentes e elegíveis entram por padrão. O usuário informa somente dados ainda desconhecidos e exceções. Um clique final confirma os fatos individuais, os vínculos, os eventos de exceção, os custos e as movimentações de estoque na mesma transação.

A presença de um OK no formulário representa uma proposta de atendimento. Não é registro de realização, reserva, baixa ou evidência clínica. Datas vencidas não executam procedimentos. O material genético pode ser informado individualmente ou distribuído entre grupos sem transformar o grupo em um fato clínico único.

## Separação entre cadastro e uso

O builder é uma tela independente em **Configurações → Pecuária → Modelos de protocolo**. Não aparece como aba ou editor dentro de uma turma, protocolo em execução ou ficha de animal. A biblioteca permite criar modelos sanitários/reprodutivos, definir quantas e quais etapas existem, seus procedimentos, produtos cadastrados e quantidades, acrescentar instruções gerais opcionais por etapa, salvar rascunhos e publicar versões. Unidade é herdada do produto; via e orientação são apenas informações opcionais de leitura quando disponíveis no cadastro.

Ao iniciar um protocolo, o usuário escolhe uma versão publicada e vincula um animal ou um conjunto. A estrutura e o modo de atendimento vêm dessa versão. Ajustar um atendimento real não altera o template. Modificar uma estrutura publicada exige derivar nova versão no cadastro; participantes existentes preservam seu planejamento.

| Modo da etapa definido no builder | Experiência durante o uso |
|---|---|
| Automatizada | Procedimentos/produtos conhecidos vêm preenchidos para todos os pendentes. O usuário confirma os OKs e ajusta exceções. Confirmação e consumo acontecem juntos. |
| Manual | O usuário informa produtos, quantidades e/ou resultados reais por animal ou grupo. Valores podem ser diferentes dentro da mesma etapa. Dados obrigatórios ausentes impedem confirmação. |

Automatizada não significa execução por horário ou baixa sem confirmação. Manual não significa exclusivamente individual: o mesmo material ou resultado pode ser atribuído explicitamente a vários animais, quando permitido pelo procedimento. Os registros finais continuam individuais. Uma etapa manual pode conservar parâmetros de referência para reduzir digitação, sem fabricar resultados.

Na interface, **etapa** é o agrupamento operacional (D0, D7 etc.), representado pelo `MomentoProtocolo` atual. Seus **procedimentos/ações** correspondem a `EtapaProtocolo` no banco existente. Manter esse mapeamento explícito evita criar entidades duplicadas ou confundir a configuração da etapa com parâmetros de uma ação.

## Decisões incorporadas

- O modo automatizada/manual é escolhido por etapa no cadastro do modelo, nunca a cada turma ou atendimento. A etapa que exige material variável ou resultado clínico precisa ser manual; parâmetros fixos de suas ações podem permanecer como referências.
- D0 pode reunir implante e várias aplicações; cada ação deve produzir uma tarefa/fato por animal. Confirmar o momento pode atender todas as ações pendentes elegíveis desse momento.
- Não exigir seleção dos animais atendidos: o conjunto pendente vem incluído, em todas as páginas. A busca e os filtros apenas mudam a apresentação. A tela declara o alcance da confirmação.
- Excluir da proposta tarefas já realizadas, dispensadas, canceladas ou incompatíveis; apresentar bloqueios e seus motivos. Uma ação já realizada não deve impedir as outras ações pendentes do mesmo animal, nem ser repetida.
- Não atendimento e adiamento exigem justificativa. Adiamento exige nova data e preserva a previsão anterior. Registrar exceção apenas em uma ação do momento deve ser possível.
- Aplicação e inserção usam produto do catálogo compartilhado. A quantidade prevista é configurada no builder; a unidade vem do produto e não é livremente editável. Via e orientação só aparecem quando cadastradas, nunca bloqueiam salvar, publicar ou atender. Quantidades reais e desvios podem ser ajustados por animal/ação com motivo.
- IA exige sêmen; TE exige embrião. Ambos admitem distribuição coletiva por material e lote, com sobrescrita individual. Mesma genética não identifica, por si só, um item físico ou lote. Embriões com identificação individual devem ser associados sem reutilização entre receptoras; lotes não individualizados preservam sua rastreabilidade disponível, sem inventar identidades.
- Confirmação reconhece atendimentos feitos pela ficha do animal. O mesmo registro atende à tarefa correspondente; não há segunda baixa ou custo.
- Não confirmar prenhez por IA/TE, passagem do tempo ou OK genérico. Resultados de exames/diagnósticos são exigidos e executados pelo fluxo clínico existente.
- Todas as listas de interface e endpoints novos têm paginação de até dez itens: animais, ações, materiais/lotes, grupos, tarefas, histórico e procedimentos. Seleção e ajustes persistem entre páginas.
- Impressão usa paginação própria de papel e cabeçalhos repetidos; limite de dez da interface não limita a população da emissão.

## Contrato do builder aprovado para esta revisão

O conjunto de procedimentos é fechado. Não oferecer “Outros”/“Outro manejo”, criação de tipos livres ou formulários genéricos capazes de declarar efeitos clínicos. Instruções gerais da etapa são texto opcional, sem execução de regras. Novos tipos exigem contrato, executor, validações e testes próprios.

| Procedimento na interface | Campos configuráveis | Dados herdados / execução |
|---|---|---|
| Aplicação de produto | Produto cadastrado e quantidade por animal | Unidade do Produto; via e orientação opcionais do cadastro. Origem/lote e exceções resolvidos no atendimento. |
| Inserção de dispositivo | Mesmo padrão de aplicação | Ação APLICACAO com subtipo INSERCAO_DISPOSITIVO; fato individual de inserção e consumo. |
| Retirada de dispositivo | Somente tipo de procedimento | Sem produto, dose ou unidade para consumo. No atendimento, referenciar inserção válida do mesmo animal; nenhuma devolução automática ao estoque. |
| Inseminação | Somente tipo de procedimento | TENTATIVA/IA; sêmen, quantidade, origem/lote e dados reais somente no atendimento individual/coletivo. |
| Transferência de embrião | Somente tipo de procedimento | TENTATIVA/TE; material e identificação disponível somente no atendimento individual/coletivo. |
| Exame / diagnóstico | Somente escolha do modelo de exame cadastrado | Campos/resultados e semântica clínica vêm do modelo versionado. Resultados preenchidos no atendimento. |

O seletor de procedimento não expõe enums internos como AVALIACAO, TENTATIVA ou MANEJO. A tradução é responsabilidade do contrato tipado. Exames clínicos não ganham efeito reprodutivo pelo nome do modelo ou texto livre: o cadastro deve declarar a semântica suportada e usar o interpretador existente. Diagnóstico positivo só produz os efeitos previstos após validação clínica.

Aplicação/inserção conservam produto de referência também quando a etapa for manual; o atendimento registra eventuais diferenças. IA/TE/exame exigem modo manual, inclusive quando coexistem com aplicações na mesma etapa. A publicação explica a incompatibilidade e exige corrigir o modo; não muda silenciosamente a escolha. Não há checkboxes para dispensar material genético ou resultados obrigatórios.

Instruções gerais são opcionais por `MomentoProtocolo`, com limite proposto de 2.000 caracteres, exibidas no atendimento e na impressão. Via e orientação não são campos de preenchimento no builder, nem requisitos do atendimento. Campos ausentes são omitidos individualmente, sem “não informado” ou pedido de completar cadastro. Preservar os valores herdados e as instruções em snapshots de versão/tarefa para não modificar o histórico quando o cadastro mudar.

A pré-sincronização pode usar as mesmas ações e terminar sem IA/TE. O mockup inclui um exemplo independente, sem alegar prescrição. A implementação deve remover a exigência indiscriminada de tentativa de todo modelo reprodutivo; a finalidade estruturada proposta e sua compatibilidade estão detalhadas em C4 abaixo. Modelos compostos e encadeamento entre participações permanecem evolução explicitamente separada: o mockup não cria vínculo automático nem presume aptidão. O calendário simplificado do mockup começa em zero, mas não substitui o contrato temporal existente: dias fracionários, horas, referências e tolerâncias devem ser preservados conforme C3. Uma futura referência distinta para D0 da sincronização deve ser modelada antes de aceitar dias negativos ou recalcular históricos.

## Plano de correção após a revisão

Estado: correções implementadas no recorte descrito no contrato vigente. A revisão encontrou dois bugs reproduzidos no mockup (C1/C2) e duas lacunas que poderiam provocar regressão na implementação (C3/C4). C5/C6 fecham a proposta de origem da retirada e a classificação da aplicação nos fluxos existentes. O calendário reprodutivo preserva horas/frações; o sanitário conserva seu contrato de dias inteiros e rejeita incompatibilidades. Ausência de persistência e integração no protótipo não foi classificada como bug de produção. Os critérios abaixo registram a solução executada; as dependências com a futura operação multiação permanecem pendentes nos pacotes 2/3.

### C1. Troca de produto e quantidade

Ao trocar o produto, limpar a quantidade e exigir novo preenchimento, mesmo quando a unidade coincidir. Atualizar imediatamente a unidade herdada e somente os metadados opcionais presentes no novo produto. Não converter nem reaproveitar silenciosamente uma dose. Selecionar novamente o mesmo ID não invalida uma quantidade já revisada. A troca de tipo de procedimento também remove parâmetros incompatíveis.

**Aceite:** trocar uma aplicação de 2 mL por dispositivo não produz 2 un; publicação fica bloqueada no campo de quantidade até o usuário preenchê-lo. Produto sem via/orientação continua válido. No sistema real, o servidor resolve a unidade pelo produto e rejeita parâmetros incompatíveis; versões antigas preservam seus snapshots.

### C2. Foco, identidade e edição por teclado

No mockup, substituir a reconstrução completa da lista em cada alteração por atualização da ação afetada, com IDs estáveis por etapa/ação e foco preservado. Na interface real, usar chaves estáveis e estado de edição independente da página. Mensagens de validação devem identificar o campo, vinculadas de forma acessível; a tentativa de publicar leva ao primeiro erro. Remover uma ação leva o foco a uma ação vizinha ou ao botão de adicionar.

**Aceite:** alterar produto, tipo ou modo e continuar com Tab mantém uma sequência previsível; nenhum evento normal de edição deixa o foco no `body`. Inserção, remoção e paginação não aplicam dados à ação errada; 11 ações permanecem em páginas de 10 e 1, com os valores preservados.

### C3. Preservação do contrato temporal

Reutilizar a representação existente de intervalo e unidade DIAS/HORAS, aceitando frações já suportadas, e `orientacaoTemporal` com referência INICIO_EFETIVO/ETAPA_ANTERIOR, intervalo em horas e tolerâncias antes/depois. Separar a apresentação compacta D0/D7 da configuração persistida; nenhuma mudança visual pode arredondar, descartar ou substituir esses campos. A ausência de horário real continua ausência de precisão, não meia-noite presumida.

O editor deve conseguir consultar e derivar versões com esses parâmetros. Se alguma combinação legada não puder ser editada com segurança na primeira entrega, mostrar a limitação e bloquear a publicação daquela derivação, preservando integralmente o original. Não recalcular tarefas existentes por edição de rascunho ou troca de apresentação. Reutilizar o cálculo temporal comum para evitar divergências entre sanitário, reprodução, ficha e turma.

**Aceite:** derivar e salvar casos com 7,5 dias, 36 horas, referência à etapa anterior e tolerâncias conserva os valores e a previsão calculada. Publicação nova não altera a agenda das participações existentes. Testes de contrato e cálculo cobrem ida e volta dos dados, inclusive ausência de horário.

### C4. Finalidade declarada e publicação

Proposta de produto para tornar verificável a regra de publicação: manter `tipo` SANITARIO/REPRODUTIVO e acrescentar finalidade estruturada à versão. Para o novo builder, oferecer sanitário, pré-sincronização/preparação, IATF e TETF; finalidade sanitária é derivada do domínio, enquanto as reprodutivas são escolhidas explicitamente. Finalidade classifica o modelo, não cria um novo tipo livre de procedimento nem produz efeito clínico.

| Finalidade proposta | Regra mínima de publicação |
|---|---|
| Sanitário | Ao menos uma ação válida e compatível com o domínio; não exige tentativa. |
| Pré-sincronização/preparação | Ao menos uma ação válida; pode terminar sem IA/TE e não presume entrada automática em outro protocolo. |
| IATF | Ao menos uma ação IA, sem material genético escolhido no builder. |
| TETF | Ao menos uma ação TE, sem embrião escolhido no builder. |

Não inferir finalidade pelo nome, pelas instruções ou pela mera presença de uma ação. Não usar essa matriz como prescrição de sequência ou dose. Modelos reprodutivos que não se enquadrem nessas finalidades permanecem no fluxo compatível atual até ter enquadramento definido; não renomeá-los nem convertê-los para preparação automaticamente.

Adicionar campo compatível por migration aditiva, preservando versões existentes sem classificação como legado explícito. Derivar uma versão legada exige escolha da finalidade apenas na nova versão. Congelar a classificação com os demais dados publicados e validar a matriz no servidor. A proposta deve aparecer no mockup antes da implementação do contrato para que o novo campo seja revisável.

**Aceite:** preparação publica sem tentativa; IATF sem IA e TETF sem TE mostram erro específico; renomear um protocolo não muda suas regras. Versões legadas e atendimentos vinculados continuam legíveis e executáveis pelo contrato vigente.

### C5. Retirada e identificação da inserção

Preparar a retirada a partir das inserções válidas do mesmo animal, verificando cronologia e retiradas anteriores. Priorizar o vínculo explícito da tarefa/participação com a inserção; quando houver exatamente uma origem elegível, apresentá-la como proposta para a confirmação. Se houver nenhuma ou mais de uma origem plausível, mostrar pendência e exigir resolução explícita ou exceção justificada; não escolher a inserção mais recente por conveniência.

Na confirmação, revalidar vínculo e concorrência com os executores e garantias SQL existentes. A proposta visível não reserva nem retira dispositivo. A retirada continua sem produto no builder e não devolve material ao estoque.

**Aceite:** cobrir zero, uma e múltiplas inserções, inserção de outro animal, data incompatível, retirada anterior e confirmação concorrente. Conflito invalida a confirmação atômica; não deixa as outras ações parcialmente gravadas. Usuário pode resolver ou justificar a exceção e confirmar novamente.

### C6. Classificação da aplicação e pré-requisitos do OK

Diretriz proposta: reaproveitar `tipoAplicacaoId` quando já configurado na ação. Para novas ações, permitir um padrão explícito e opcional no perfil sanitário do produto, usando o catálogo de tipos existente, sem inferência por nome. A ação publicada conserva o vínculo resolvido em snapshot. O padrão do produto só auxilia novas configurações; mudanças posteriores não reinterpretam versões publicadas.

Não adicionar um seletor obrigatório de classificação no builder. Quando o executor exigir classificação e ela não estiver resolvida, mostrar uma pendência de configuração para modo automatizado; é possível corrigir o cadastro ou usar modo manual com preenchimento operacional explícito. Essa classificação é distinta de via/orientação, que continuam opcionais e nunca bloqueiam publicação ou atendimento. O padrão no perfil de produto é uma extensão proposta de cadastro e precisa ficar visível na revisão do contrato, não ser implementado como suposição oculta.

O clique final só fica disponível depois de resolver também origem/lote, disponibilidade e demais requisitos reais. Automatizada significa confirmar parâmetros conhecidos, não dispensar validações. Material genético e resultados continuam preenchidos no atendimento individual ou coletivo, com fatos separados por animal.

**Aceite:** aplicação sem classificação exigida não chega ao executor como OK válido; classificação resolvida não exige repetição por animal; ausência de via/orientação não gera pendência. Fatos individuais anteriores são reconhecidos e não consomem estoque novamente.

### Agentes, modelo e esforço de execução

As frentes de implementação e revisão das correções usaram **`gpt-6.1-sol`**. A distribuição abaixo também orienta os pacotes funcionais ainda propostos. Astra não foi utilizado nesta execução.

| Agente / responsabilidade | Modelo | Esforço | Entrega e dependências |
|---|---|---|---|
| Coordenador e integrador | gpt-6.1-sol | high | Confirma estado do checkout, fecha contratos compartilhados, atribui arquivos, integra e verifica o conjunto. |
| Builder e acessibilidade | gpt-6.1-sol | medium | Corrige C1/C2 no mockup; depois leva o comportamento aos componentes reais. Incorpora C3/C4 após definição do contrato. |
| Contratos, calendário e versões | gpt-6.1-sol | high | Implementa C3/C4, DTOs, validações e migrations aditivas, incluindo preservação do legado e snapshots. |
| Atendimento e cadastros | gpt-6.1-sol | high | Implementa C5/C6 e sua integração com a preparação/confirmação dos pacotes 2/3 abaixo; depende do contrato compartilhado. |
| Revisor independente | gpt-6.1-sol | high | Revisa diff e invariantes, reproduz cenários de erro e verifica evidências antes da integração final. Não reaproveita conclusões sem conferir o código. |

Para controlar gasto: tarefas com escopo e arquivos definidos, contexto enxuto com decisões e caminhos, testes direcionados primeiro e no máximo dois implementadores simultâneos após estabilizar contratos. Um único dono edita schema, migrations e DTOs compartilhados; os demais recebem o contrato e evitam alterações concorrentes nesses arquivos. Revisão concentra-se nos riscos e diferenças da entrega, sem repetir auditoria completa do repositório.

### Ordem, evidências e conclusão das correções

1. **Protótipo corrigido:** C1/C2, configuração temporal C3 e finalidade proposta C4 no builder demonstrativo. Verificação visual e por teclado, incluindo 11 itens. Atualizar o README do artefato para distinguir recursos simulados de integração real.
2. **Contrato e compatibilidade:** C3/C4/C6 no cadastro, API, schema e snapshots; testes de publicação, derivação e preservação do legado. Esse trabalho antecede o builder real e não habilita sozinho o atendimento por exceção.
3. **Operação:** C5/C6 sobre a prévia e confirmação transacional dos pacotes 2/3; reutilizar os fatos clínicos, estoque e custos existentes. Não entregar um OK que apenas atualize a interface.
4. **Interface integrada:** aplicar C1/C2 ao builder real e apresentar pendências acionáveis da operação; listas e endpoints limitados a dez, com alcance global de confirmação independente da página.
5. **Revisão independente:** testes direcionados, tipos/builds afetados, inspeção desktop/mobile e teclado, e revisão de migration/SQL e atomicidade. Registrar separadamente o que passou, o que não foi executado e o que depende de homologação de campo.

Conclusão exige os seis itens verificáveis, compatibilidade com sanitário/reprodutivo e individual/coletivo, e nenhuma alteração incidental nas outras frentes locais. A correção do protótipo não encerra os pacotes funcionais deste plano. Testes de integração seguem exclusivamente as restrições de dados da seção de validação; revisão documental não autoriza reset, carga, deploy ou publicação de PR.

## Base existente e diferença necessária

| Base inspecionada | Reaproveitamento | Evolução necessária |
|---|---|---|
| `Protocolo` com `versao`, publicação e `referenciaTecnica` | Modelo versionado já existente | Política automatizada/manual por etapa e campos obrigatórios por ação |
| `MomentoProtocolo` / `EtapaProtocolo` | Agrupar ações; produto, dose, unidade, via e configuração | Builder independente de modelos, quantidade livre de etapas, procedimentos e política por etapa |
| `ParticipacaoProtocolo` / `TarefaProtocolo` | Individualização, planejamento congelado e vínculos | Selecionar no servidor todas as tarefas elegíveis do momento e congelar o conjunto da preparação |
| `EventoTarefaProtocolo` | Não atendimento, adiamento e justificativa | Confirmar eventos junto do atendimento; exceções por ação |
| `execucao.schemas.ts` | Envelope v1, limite de 100 itens, prévia e idempotência | Hoje rejeita repetição de animal e atende uma ação/contexto. Um momento com várias ações do mesmo animal exige envelope v2 e orquestração próprios |
| `execucao.ts`, `execucao.clinica.ts`, `execucao.manejos.ts` | Executores existentes, confirmação transacional e fatos | Coordenar todos os executores numa única transação, com recibo por tarefa |
| `EditorExecucaoProtocolo`, `EditorExecucaoClinica`, `EtapasProtocolo` | Componentes da ficha e da programação | Padrão incluído, ajustes por exceção, distribuição de material e resumo global |
| `custos/estimativa-protocolo.ts`, consumo de estoque, visitas/emissões | Referências, custos realizados, saldo e snapshots | Previsão de materiais por contexto e impressão do plano + reconciliação |

O levantamento é de código e schema local. Nenhuma consulta de banco ou homologação de campo foi feita para este plano.

### Pontos de integração conferidos no código local

- `server/prisma/schema.prisma`: `Produto.unidade` já existe. `PerfilSanitarioProduto.viaPadrao` é opcional e `referenciaTecnica` existe, mas não há campo específico de orientação de uso. Não renomear ou tratar automaticamente referência técnica como instrução. Propor `orientacaoUso String?` no perfil sanitário via migration aditiva e expô-lo opcionalmente no cadastro compartilhado; dados antigos ficam nulos.
- `services/pecuaria/protocolos/cadastros-opcoes.ts`: produtos filtrados por uso sanitário e ativos, retornando unidade, mas sem via/orientação. Ampliar DTO com perfil opcional, preservando escopo, ID selecionado legado e paginação dez. O catálogo é único; não criar tabela paralela de produtos do builder. Saldo zero não impede configurar um modelo.
- `services/pecuaria/reproducao/schemas.ts`: o plano de tentativa exige material/quantidade no cadastro e a publicação exige uma tentativa. Separar contrato de configuração do contrato de realização: no modelo novo IA/TE carregam apenas o tipo; na realização material e demais dados continuam obrigatórios. Não enfraquecer o executor clínico nem alterar silenciosamente payloads antigos.
- `TipoExame`, formato versionado e `opcoes-clinicas.ts`: reaproveitar seleção e hash do formato. Verificar/completar no cadastro de exames o vínculo entre modelo e finalidade clínica suportada para que escolher um exame seja suficiente; não inferir diagnóstico, reconfirmação ou sexagem por nome. Modelos existentes sem metadados conservam tratamento compatível explícito.
- `MomentoProtocolo` e suas migrations de imutabilidade não têm modo/instruções. Acrescentar campos opcionais de compatibilidade e snapshots; não editar migrations aplicadas.
- `execucao.manejos.ts` e guardas SQL já conservam origem de retirada e impedem reutilização incompatível. Reutilizar isso; ausência de produto no builder não elimina o vínculo factual com a inserção.
- A retirada de “Outros” vale para criação/edição no builder novo. Fatos e versões antigas com MANEJO continuam consultáveis/executáveis pelo contrato legado; não apagar nem converter procedimentos existentes.

## Fluxo de operação

1. Abrir contexto: versão, programação ou participação individual, momento e sítio.
2. Preparar no servidor o conjunto completo elegível. Retornar identificador de preparação, revisão/hash, totais e primeira página. Não carregar todas as linhas no cliente como condição de correção.
3. Ler o modo congelado da etapa. Na automatizada, exibir os OKs propostos e parâmetros conhecidos. Na manual, apresentar todos os participantes com os campos reais a completar, individualmente ou por grupo. Exibir fatos já existentes. Mostrar quantas tarefas e animais serão confirmados, separadamente.
4. Aplicar dados comuns de execução: data/precisão, responsável, origem e lote dos materiais. Quando há mais de um lote, permitir distribuição explícita; não escolher lote ou origem silenciosamente.
5. Informar material genético para todos ou grupos. Marcação de animais nesse painel serve exclusivamente à distribuição do material; não redefine quem será atendido.
6. Aplicar exceções por animal/ação: não realizado, adiamento, produto alternativo, quantidade e parâmetros reais. Demais ações continuam incluídas.
7. Mostrar consumo agregado por produto, sítio, origem e lote; saldo antes/depois, custos apurados e campos faltantes. Origem externa/serviço/compra direta segue o contrato existente, sem baixa fictícia do estoque próprio ou dupla cobrança.
8. Confirmar em um clique após os campos obrigatórios estarem válidos. Revalidar a preparação no servidor e devolver recibo paginado com fatos e exceções.
9. Reconsultar ficha, protocolo, estoque e custos. Saldo insuficiente, conflito ou erro desfazem todo o conjunto; preservar o rascunho para correção. Reenvio recupera recibo sem repetir efeitos.

## Pacotes de implementação e dependências

### 1. Cadastros, contrato tipado e migração aditiva

Implementar primeiro os metadados opcionais do cadastro de produtos e os requisitos semânticos dos modelos de exame descritos acima. Resolver o tipo de aplicação sanitária conforme C6: vínculo existente da ação ou padrão explícito do produto, com tratamento manual quando não resolvido. Não inventar classificação pelo nome nem introduzir outro campo obrigatório no builder.

Definir `modoAtendimento` AUTOMATIZADA/MANUAL e `instrucoesGerais` opcionais por etapa de interface (`MomentoProtocolo`), com migration aditiva, e configuração discriminada por procedimento em `EtapaProtocolo.configuracao`. Rejeitar campos incompatíveis no contrato novo (produto em retirada, material genético no template, resultado clínico predefinido). Resolver unidade e metadados no servidor a partir do produto; impedir unidade adulterada no payload. Guardar cópia dos dados resolvidos na versão publicada e na tarefa. Ao trocar produto no rascunho, atualizar a unidade e pedir revisão da quantidade, sem conversão numérica presumida. O mockup mostra quantidade fixa por animal; cálculo por peso continua fora deste recorte.

Permitir pré-sincronização sem tentativa. Preservar contratos antigos enquanto cadastro e operação adotam o contrato novo; planos com material genético fixo anteriores não são apagados ou reinterpretados. O novo builder não oferece editar esse material: derivação deve informar sua remoção apenas na nova versão.

Congelar modo no `momentoSnapshot` e os parâmetros obrigatórios no planejamento da tarefa. Publicação valida que todas as ações da etapa são compatíveis com o modo: um resultado desconhecido não pode ser confirmado como previsto. Não criar outra entidade de versão paralela a `Protocolo`. Legado sem momento ou sem modo explícito mantém tratamento compatível identificado, sem inferir agrupamentos ou automação retroativa.

Versões publicadas/usadas seguem imutáveis. Derivação cria nova versão; legado ausente mantém comportamento compatível, sem habilitar confirmação automática ou reescrever snapshots. Acrescentar SQL somente onde forem necessárias novas garantias de preparação, distribuição ou recibos. Fechar a escolha de persistência da preparação antes da migration: preferir o mecanismo de idempotência existente se comportar conjunto congelado e revisão; caso não comporte, adicionar preparação própria, com escopo, autoria, expiração e hash.

**Aceite:** mesma versão não muda retroativamente; produto sem via/orientação publica normalmente; unidade é resolvida no servidor; retirada não aceita consumo; IA/TE publicam sem material no template e continuam exigindo material na execução; pré-sincronização publica sem tentativa; tipo desconhecido é rejeitado; participação individual não depende de turma; contratos sanitário/reprodutivo convergem sem escrever nas views legadas.

### 2. Prévia completa do momento

Criar serviço de preparação por contexto/momento, com autorização, sítio e elegibilidade. Retornar tarefas em páginas de dez, resumos do conjunto e bloqueios. Alterações de estoque, participação, tarefa ou fato após a preparação invalidam/revalidam a prévia; nunca acrescentar novos animais silenciosamente na confirmação.

A API não deve aceitar `todos=true` sem identidade/revisão do conjunto. Exceções e distribuição referenciam IDs estáveis de tarefa/animal. Distinguir omissão (manter plano) de exclusão explícita (evento justificado).

**Aceite:** 11, 28 ou mais animais são contabilizados mesmo exibindo dez; busca não muda escopo; tarefa já atendida pela ficha não aparece como novo consumo.

### 3. Confirmação atômica de várias ações

Adicionar envelope v2 e executor por momento, preservando v1. Remover a restrição de animal único somente no contrato novo; exigir unicidade de tarefa e compatibilidade entre animal, participação, versão, momento e sítio. Reusar executores transacionais; não encadear chamadas HTTP independentes para cada ação.

Calcular consumo sobre quantidades reais por tarefa; validar unidades/conversões, disponibilidade/lotes, carência, origens e regras financeiras antes da gravação. Manter Decimal, autoria, idempotência e ordenação de locks. Persistir fatos, movimentos, custos, vínculos, eventos e recibo atomicamente. Anulações usam os fluxos de estorno/correção existentes, sem apagar históricos.

O teto atual de 100 itens não comporta automaticamente 100 animais × várias ações. Definir limites de animais e tarefas com ensaios de carga no runtime suportado. Não dividir silenciosamente uma confirmação em transações. Se exceder o limite validado, bloquear claramente e oferecer grupos explícitos; nunca afirmar atomicidade de grupos já separados.

**Aceite:** falha na última ação não deixa as anteriores gravadas; clique duplo/reenvio não duplica fatos; disputa por saldo não produz estoque negativo; exceções sem atendimento também podem ser confirmadas.

### 4. Distribuição genética e clínica

Reaproveitar seletores de material, lote e executores IA/TE. Adicionar distribuição para todos pendentes ou subconjuntos, preservando diferenças já informadas e exigindo ação explícita para substituí-las. Dados obrigatórios de tentativa, técnica, responsável, origem e material vêm do contrato clínico vigente.

Mesmo material pode atender vários animais quando houver saldo. Validar identificações individuais de embriões quando existentes, estoque/lote, compatibilidade do tipo e vínculo genético correto. Não confundir doadora com receptora. Diagnóstico exige resultado individual; permitir preenchimento comum explícito somente quando o contrato clínico permitir, sem resultado presumido.

**Aceite:** seis doses para seis animais; dois touros em grupos diferentes; quatro embriões para quatro receptoras; material obrigatório; tentativa registrada sem gerar prenhez presumida; diagnóstico válido pelo executor pode atualizar gestação.

### 5. Interface comum e builder

Evoluir `ProtocolosCadastro`, o cadastro reprodutivo hoje acessado por `Iatf`, `AcoesCadastro`, `CamposMomentoAcao` e seletores existentes. Disponibilizar o builder somente na biblioteca de modelos em Configurações, com URLs próprias para listagem, criação, edição de rascunho e derivação de versão. Fluxos operacionais apenas selecionam/consultam a versão publicada. Editor de versão: momentos, instruções opcionais, procedimentos tipados, seletores de produtos/modelos de exame, quantidade, unidade herdada e modo automatizada/manual. Exibir via/orientação somente quando houver no produto. IA/TE não mostram seletores de material ou quantidade; retirada não mostra campos de produto; exames mostram apenas o seletor do modelo e sua prévia de leitura. Não oferecer “Outros” nem edição livre de requisitos clínicos. Diagnósticos e IA/TE exigem modo manual. Uma aplicação também pode pertencer a uma etapa manual quando seus produtos/resultados variam por animal ou grupo. O modo não é inferido somente do tipo do procedimento.

Evoluir `OperacaoProtocolo`, `EtapasProtocolo` e editores compartilhados. Manter etapa e animais no mesmo componente colapsável, custos/procedimentos ao final, ajuste abaixo do animal e botões nas ações. Acesso individual pela ficha usa o mesmo serviço. Registrar desvios por ação, inclusive atendimento parcial de um momento.

Todas as listas têm limite servidor/cliente de dez; estado editado é independente da página. Declarar conjunto completo e totais no botão final. Campos obrigatórios e bloqueios têm mensagens junto ao campo e resumo acessível. Atendimentos já existentes são legíveis e não editáveis por este formulário.

**Aceite:** o builder não recebe IDs de turma/participação; não há editor de template na operação; mudar o modo de uma nova versão não altera atendimentos existentes. Não há checkbox de inclusão por animal no fluxo padrão; checkboxes existem somente na distribuição genética quando necessária; foco e ajustes sobrevivem a paginação; nenhuma ação confirmada fica apenas no estado visual.

### 6. Ficha impressa e documentação

Aproveitar snapshots de emissão e infraestrutura de arquivos existentes. Gerar instruções por momento, produtos previstos, população considerada, material genético a preencher, campos de exceção e identificação de versão/emissão. Repetir cabeçalhos, permitir múltiplas folhas e identificar recortes. Custos de material genético ainda não escolhido aparecem como pendentes/não estimados, nunca zero presumido. Referências de custo independentes já existentes permanecem distintas de uma seleção de produto genético no template. Planejamento não imprime OK como prova de execução; campos de confirmação e fatos já registrados devem ser distinguíveis.

Reconciliação usa contexto/versão/animal/tarefa, registra data real com precisão disponível e evita duplicidade. Não pressupor OCR automático ou integração externa. Atualizar contratos e artefatos depois da implementação; incorporar decisões vigentes e retirar este plano temporário quando concluído.

### 7. Validação e entrega

Testes do builder/contrato: matriz dos seis procedimentos e campos permitidos; instruções opcionais com limite; produto sem metadados; apenas via/ambos os metadados; troca de produto/unidade; produto inativo preservado em versão antiga; ausência/alteração de modelo de exame; IA/TE sem material no template e com material obrigatório na realização; retirada sem produto; remoção de campos residuais ao trocar tipo; bloqueio de etapa automatizada com exame/IA/TE; proibição de tipo livre no servidor; pré-sincronização sem tentativa; derivação e snapshots imutáveis. Verificar que nomes/instruções não criam efeitos clínicos.

Testes puros: expansão de ações, quantidades agregadas, unidades, exceções e distribuição. Componentes: default completo, paginação 10/11/28, busca, grupo genético, bloqueios, atendimento individual, teclado e estado de carregamento/erro. Integração: atomicidade multiação, saldo concorrente, idempotência, fatos anteriores, snapshots e custos/gestação.

Integrações locais somente em `fazendinha_seedatev3` com fixtures próprias previamente revisadas. Sem reset, clone, banco temporário, recarga de seed ou alteração de migrations aplicadas. Ensaios que recriam estrutura ficam no CI externo. Validar builds, tipos e testes proporcionais; inspecionar desktop/mobile e impressão; separar evidência técnica de homologação de campo.

## Sequência

1 → 2 → 3 é o caminho crítico. 4 depende de 2/3. 5 pode começar pelo builder após 1 e integrar operação após 2/3/4. 6 usa os contratos estabilizados; 7 acompanha cada pacote e fecha a entrega. Manter PR de implementação separado desta proposta documental; não publicar/deploy por efeito colateral.

## Entregas revisáveis

1. Catálogos e contrato novo, com testes e migrations aditivas, preservando a operação antiga.
2. Builder conectado à API, com os seis formulários e publicação/derivação reais; ainda sem habilitar atendimento por exceção até concluir sua integração.
3. Prévia e confirmação por momento, estoque/custos, material genético e clínica, comuns à ficha e à turma.
4. Emissão, regressões, inspeção de desktop/mobile e atualização do contrato vigente. Ativação coordenada somente após validar compatibilidade entre as entregas.

## O que o mockup demonstra

- IATF D0 com 12 animais, um atendimento prévio e 11 novos incluídos entre duas páginas; D7 aplicação, D8 retirada, D10 inseminação com seis animais.
- TETF com quatro receptoras e distribuição de quatro embriões; cenário sanitário e contexto individual.
- Ajuste por animal, justificativa, adiamento, material e quantidade; consumo recalculado; saldo insuficiente bloqueia confirmação.
- Confirmação em memória, recibo, saldo atualizado e procedimentos/custos paginados.
- Biblioteca independente de modelos, criação/derivação de versões, inclusão/remoção de etapas e procedimentos, modo automatizada/manual por etapa, instruções opcionais, seis tipos fechados, catálogos fictícios de produtos/exames e publicação simulada. Modelos, etapas e procedimentos têm paginação de dez.
- A operação demonstra os modos automatizada (D0/D7/D8) e manual (IA/TE), definidos pelos modelos fixos da demonstração. Não contém editor de estrutura.

Limites: a biblioteca demonstrativa não alimenta o exemplo fixo de operação; nenhum modelo publicado no mockup é adotado por uma turma real. Dados, doses e referências fictícios; não há prescrição, API, banco, auditoria durável ou integração real com estoque. O exemplo usa estoque próprio, um lote por material e ajustes do momento inteiro por animal; edição de exceção em uma única ação, múltiplos lotes por aplicação, origens externas e emissão impressa fazem parte do plano, não desta simulação. Não valida concorrência, regras clínicas, permissões, reservas ou implantação.
