# Regularização do Bezerreiro pela localização

Este procedimento adapta **somente a permanência atual comprovada** de animais que já ocupam um lote escolhido explicitamente para o Bezerreiro. Não reconstrói automaticamente intervalos históricos encerrados. O executor é a API autenticada do módulo; a ferramenta de prévia não abre conexão com o banco nem envia comandos.

O contrato operacional permanece em [Bezerreiro](bezerreiro.md). `PerfilBezerreiro` é único por lote. Configurar um lote ocupado exige conferência explícita de suas localizações atuais e justificativa; não cria movimentações fictícias. A execução autorizada cria/reutiliza o perfil e regulariza as participações na mesma transação, sem fase alimentar presumida. Não usar SQL manual para contornar essa conferência.

## Entradas e proveniência

Os arquivos privados ficam fora do Git, conforme [dados de desenvolvimento](../desenvolvimento.md). Preserve as evidências recebidas e produza arquivos novos para cada revisão. Nunca substitua um snapshot/manifesto aprovado por outro arquivo com o mesmo nome.

- `lotes.json`: IDs dos lotes/sítios conferidos e identidade do ambiente. A identificação inicial pode consultar o nome e o sítio; depois disso, a ferramenta seleciona exclusivamente pelos IDs explícitos. Não descobre lotes por nome ou categoria de animal.
- `animais-stg.json`, `analise-animais.json` e `RELATORIO.md`: retrato anterior e comparação documental com IDEAGRI. Os dois JSON precisam conter a mesma coorte, sem IDs duplicados e com os mesmos campos `ideagriId`, `propriedadeId` e `desde`.
- `snapshot.json`: resultado integral da SELECT emitida pela ferramenta, executada em fonte somente leitura no ambiente explicitamente conferido. A coleta reúne os animais da coorte anterior **e todos os ocupantes atuais dos lotes**, todas as suas localizações e participações, perfis envolvidos, fases, ofertas e baixas. Isso identifica animais movidos, novos ocupantes e cadastros feitos após a primeira análise.

Exemplo **sintético** da identificação de lotes:

```json
{
  "versao": 1,
  "fonte": {
    "projetoId": "projeto-sintetico",
    "branchId": "branch-stg-sintetico",
    "banco": "banco-sintetico",
    "ambiente": "stg"
  },
  "lotes": [
    { "id": "lote-sintetico", "propriedadeId": 999, "sitio": "Sítio sintético" }
  ]
}
```

O arquivo real deve conter os IDs já existentes e o ambiente confirmado. Não criar lotes, animais, sítios ou bancos para satisfazer o exemplo. O rótulo de branch gravado no JSON não comprova sozinho o destino da conexão: o responsável pela coleta deve conferir projeto, branch e banco na ferramenta de leitura utilizada.

## Gerar a prévia

Execute a partir da raiz do repositório. Os caminhos abaixo são exemplos; a ferramenta não lê `.env`, `DATABASE_URL`, tokens ou credenciais.

```bash
node server/scripts/bezerreiro-localizacao/previa.mjs \
  --lotes=/caminho/privado/lotes.json \
  --evidencias-dir=/caminho/privado/evidencias \
  --emitir-consulta \
  --saida=/caminho/privado/consulta-nova.sql
```

O comando apenas grava uma SELECT. Execute essa consulta em sessão/conector autorizado **somente leitura**, explicitando projeto, branch STG e banco conferidos; salve o objeto `snapshot` retornado como JSON novo. A SELECT única mantém consistência entre coleções e grava instante, data de referência e identidade transacional. Não copie credenciais para o manifesto.

```bash
node server/scripts/bezerreiro-localizacao/previa.mjs \
  --lotes=/caminho/privado/lotes.json \
  --evidencias-dir=/caminho/privado/evidencias \
  --snapshot=/caminho/privado/snapshot-novo.json \
  --saida=/caminho/privado/manifesto-novo.json
```

O padrão é somente leitura. Não há opção `--executar`. `--saida` usa criação exclusiva e recusa sobrescrever arquivos; sem esse argumento, a saída vai para stdout. Sem `--snapshot`, a ferramenta produz um manifesto bloqueado com `SNAPSHOT_ATUAL_AUSENTE`. Snapshot com mais de 24 horas ou instante futuro também bloqueia os comandos. A janela permite revisar a prévia; **não dispensa nova coleta imediatamente antes da execução**.

O manifesto registra versão da regra, hashes SHA-256 dos arquivos de evidência e do snapshot normalizado, instante, fonte, motivos, conflitos, IDs/versões existentes e os comandos propostos. `executavelAutomaticamente` permanece `false`. Um comando proposto não constitui aprovação nem comprova execução.

## Critérios de conciliação

Cada animal recebe uma situação para a permanência atual:

| Situação | Efeito proposto |
|---|---|
| `COMPROVADO` | Propor participação desde o início exato da localização atual aberta, no mesmo lote/sítio, sem fase. |
| `JA_CONCILIADO` | Conservar participação que já cobre integralmente a permanência atual, incluindo ID, versão e fatos. |
| `PENDENTE` | Não executar; conferir ausência de prova, cronologia, escopo, baixa, sobreposição, perfil inativo ou fatos dependentes. |

O intervalo proposto é `[LocalizacaoAnimal.desde, sem fim)`. Nascimento e entrada na fazenda são verificações cronológicas, não fontes presumidas da entrada no Bezerreiro. Intervalo anterior encerrado não é reaberto. Participação parcial/sobreposta não é alargada, fragmentada ou substituída pela prévia. Localização vazia legada não vira participação; participação/fase vazia exige regularização explícita.

A situação do histórico é independente: `DATAS_COINCIDENTES` registra apenas coincidência entre datas; `ANTECEDENTE_IDEAGRI_PENDENTE` mantém a entrada anterior no grupo como pendência documental. A data IDEAGRI não é adotada como início de participação nem atravessa transferências de sítio. Uma permanência atual comprovada pode ser regularizada enquanto sua história anterior continua pendente e preservada. `HISTORICO_PENDENTE` cobre ausência de correspondência ou outra diferença a conferir.

Anotações de cor/desmama, idade, peso, categoria e vínculos de parto/pesagem permanecem evidências, sem produzir fase, coleira, dose, desmama realizada, colostragem, ingestão, estoque ou custo. Participação sem fase é **Sem programação**, diferente de dose zero. Fases e ofertas existentes são conservadas; fatos dependentes sem participação conciliada bloqueiam a proposta.

Um conflito em qualquer ocupante bloqueia o comando coletivo daquele lote. A coorte do comando deve coincidir exatamente com as localizações atuais na execução; não remover um item conflitante para obter um resultado parcial silencioso. Dados de outros lotes/sítios não recebem comandos por terem animais da coorte anterior.

## Execução pelo chat responsável pelos dados

1. Confirmar publicação do código no STG, CI e compatibilidade do contrato. Publicação e regularização são ações separadas; migrations não incorporam dados históricos silenciosamente.
2. Coletar snapshot novo somente leitura, gerar manifesto novo e revisar os motivos, propostas, pendências históricas e comandos com o responsável pelos dados. Conferir o conjunto completo de ocupantes, IDs de lote/sítio, localizações e datas; não exigir que o total permaneça igual ao retrato anterior.
3. Aprovar explicitamente o manifesto revisado e sua abrangência. Não considerar este documento ou a existência do arquivo como autorização de execução.
4. Enviar os comandos `PROPOSTO_PARA_REVISAO` à API com sessão de usuário real, permissão Pecuária/`lancar` e escopo do sítio. Usar `POST /api/pecuaria/rebanho/bezerreiro/perfis`, `X-Propriedade-Id` do comando e seu `corpo` integral. Não gravar o token/cookie no arquivo de evidência.
5. Conservar `chave`, motivo e payload em reenvio após resposta incerta. A API verifica sob trava a lista exata `{id, animalId, desde}` do lote e sua localização atual, valida dependências e executa atomicamente; divergência exige nova prévia e revisão, sem completar por SQL manual. Não reutilizar uma chave com dados alterados.
6. Coletar snapshot posterior novo e gerar nova prévia: os animais regularizados devem aparecer como `JA_CONCILIADO`, sem novos participantes duplicados, alterações em localização ou fases inventadas. Conservar IDs, respostas, autoria, hashes e evidência antes/depois em diretório privado.

Cada comando é atômico por lote; dois sítios são duas transações. Se um comando falhar, não declarar a carga inteira concluída nem desfazer por exclusão os fatos do outro sítio. Reavaliar o estado atual, preservar a resposta do que concluiu e retomar apenas o que continua pendente.

Para ampliar a cobertura histórica depois, conciliar também localizações encerradas, transferências, baixas e fatos realizados com sua evidência específica. A ferramenta atual deixa essa reconstrução pendente; não apresentar sua execução como carga de todo o histórico.

## Validação

```bash
node --test server/scripts/bezerreiro-localizacao/modelo.test.mjs
```

Os testes da ferramenta usam somente dados sintéticos em memória/arquivos temporários, sem conexão com PostgreSQL ou API. Cobrem prévia sem snapshot, snapshot incompleto/antigo, escopo, lotes explícitos, novos ocupantes, animais movidos, conflitos, preservação de fatos/versões, datas, fases não presumidas, reenvio determinístico e recusa de escrita/sobrescrita no CLI.

Esses testes não comprovam locks/constraints PostgreSQL, concorrência da execução real, publicação ou homologação da fazenda. A validação transacional da API pertence aos testes do domínio; a revalidação somente leitura dos dados não equivale a executar a carga.
