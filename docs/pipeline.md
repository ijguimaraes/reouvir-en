# Pipeline de geração de frases

> Rascunho de desenho. A pipeline é um **projeto à parte** (decisão do `AGENTS.md`); este documento fica aqui só para guiar o contrato com o banco e o fluxo. Se virar outro repositório, mova-o junto.

## 1. Objetivo

Produzir, por **contexto**, as frases de cada tópico do currículo (~100 por playlist) e **gravá-las direto no Postgres** (seção 8 de [`estrutura-do-projeto.md`](estrutura-do-projeto.md)), respeitando a regra: **nenhuma frase usa gramática de um tópico posterior**.

A pipeline é dona da pedagogia (ordem dos tópicos, regras de gramática, prompts, modelo) e do catálogo de níveis e tópicos. O banco garante a integridade (normalização do texto, hash, versão da playlist) e o backoffice só lê o catálogo, revisa as frases e publica.

Idioma dos dados: **tudo em inglês** (nomes e slugs dos tópicos, descrição e cenas do contexto, prompts).

## 2. Fluxo

```
curriculum-*.yaml ─┐
contexto (yaml)  ──┼─► 1 Gerar ─► 2 Validar (código) ─► 3 Juiz (LLM) ─► 4 Gravar no banco ─► 5 Revisar
vocabulário CEFR ──┘      │              │                    │              (SQL)             (humano, no backoffice)
                          └──── reprova ─┴──── reprova ───────┘
                               regenera só as frases reprovadas (máx. 3 rodadas)
```

Uma unidade de trabalho é `(contexto, nível, tópico)`. As etapas 1 a 3 leem e gravam JSONL em disco, são idempotentes e retomáveis (pulam o que já existe com o mesmo hash de entrada).

| # | Etapa | Entrada → saída | LLM? |
|---|---|---|---|
| 1 | Gerar | currículo + contexto → `candidates.jsonl` (~130 por tópico) | sim |
| 2 | Validar | candidatas → `validated.jsonl` + motivos de rejeição | não |
| 3 | Juiz | aprovadas pelo passo 2 → notas e veredito | sim (outro modelo) |
| 4 | Gravar | aprovadas, ordenadas → linhas de `sentences` no Postgres | não |
| 5 | Revisar | amostra de 10–20% por playlist + todas as de alerta; o admin publica | humano |

## 3. Currículo

Fica em arquivos declarativos, **agnósticos a contextos** (só gramática e nível; exemplos neutros do dia a dia), um por nível: [A1](pipeline/curriculum-a1.yaml), [A2](pipeline/curriculum-a2.yaml), [B1](pipeline/curriculum-b1.yaml) e [B2](pipeline/curriculum-b2.yaml). O catálogo de recursos gramaticais, com a regra spaCy de cada um, é [`pipeline/features.yaml`](pipeline/features.yaml).

- Cada tópico declara o que **introduz** (`introduces`) e as **estruturas** que a playlist deve cobrir (`structures`, cada uma com regra spaCy e frase de exemplo).
- A ordem gramatical é **cumulativa entre níveis** (A1 → A2 → B1 → B2): o permitido num tópico é o `baseline` mais tudo o que os tópicos anteriores introduziram. O **proibido é derivado** (todo recurso do catálogo ainda não introduzido); não é escrito à mão.
- Um assunto pode reaparecer em nível acima, com mais profundidade: o tópico novo tem slug próprio e `deepens` aponta o anterior (ex.: `question-words` aprofunda o `wh + be` do A1).
- **Tópico sem recurso novo** (`introduces: []`, hoje só `present-perfect-vs-past-simple`) é uma **revisão aprofundada**: o prompt pede mais variantes das estruturas já ensinadas (outros sujeitos, verbos, tempos, formas afirmativa, negativa e interrogativa, posições na frase).
- `added: true` marca tópicos que não estão no seed do documento e entram como pré-requisito (`past-of-to-be`, `possessive-pronouns-and-genitive`).

**O currículo é o catálogo.** O banco nasce vazio e o backoffice só lê níveis e tópicos, então são estes arquivos que os criam (ver seção 7):

| Currículo | Banco |
|---|---|
| `level.code`, `level.name`, `level.order` | `levels.code`, `levels.name`, `levels.sort_order` |
| `topic.slug`, `topic.name`, `topic.order` (dentro do nível) | `grammar_topics.slug` (único no catálogo todo), `.name`, `.sort_order` |

## 4. Validação determinística (etapa 2)

Roda com spaCy (`en_core_web_sm` basta). Antes de tudo, cada candidata passa pela **mesma normalização do banco** (`normalizeText` em `packages/shared/src/text.ts`: NFC, aspas e apóstrofos retos, `...`, espaços únicos e sem bordas). Isso importa de verdade: com apóstrofo curvo (`isn’t`) o spaCy tokeniza `n’t` e as regras de contração deixam de detectar.

Uma frase é **rejeitada** se:

- usa qualquer recurso do catálogo (`features.yaml`) que ainda não foi introduzido naquele ponto do currículo;
- tem palavras fora da faixa do nível (A1–A2: 4–10; B1–B2: 8–18; contagem por espaços, como `countWords` do app);
- contém URL ou emoji (mesmas regras de `hasUrl` e `hasEmoji`), dígito ou abreviação (o TTS lê mal);
- repete outra frase da playlist **depois de normalizada** (o banco recusa o INSERT inteiro por `UNIQUE (playlist_id, text_hash)`) ou fica muito parecida (embedding, limiar a calibrar);

**O validador já existe** em [`pipeline/validator/`](../pipeline/validator/) (`rules.py` é a DSL das regras, `analyze.py` roda a análise). Hoje ele valida os próprios currículos: cada estrutura precisa ser detectada pela regra no seu exemplo, caber na faixa de palavras e não usar recurso posterior. O resultado está em [`pipeline/analise-estruturas.md`](pipeline/analise-estruturas.md), regerado por `python analyze.py ../../docs/pipeline ../../docs/pipeline/analise-estruturas.md` (requer `pip install -r requirements.txt` e `python -m spacy download en_core_web_sm`). O **validador de frases** também existe: [`pipeline/src/validate.py`](../pipeline/src/validate.py) (normalização igual à do banco, URL, emoji, dígito, abreviação, faixa de palavras, duplicatas, gramática por tópico, cobertura das estruturas) com testes em `test_validate.py` (`python -m unittest test_validate`).

**Regra de uma oração.** Até o tópico `simple-connectors` (A2 · 13) cada frase tem **uma** oração: um sujeito e seus verbos. A feature `multi_clause` (dois sujeitos próprios, ou vírgula + `and/but/or/so`) é rejeitada antes disso. Continuam liberados `and`/`or` entre palavras (*Tom and Ana*, *tea or coffee*) e entre verbos com o mesmo sujeito (*I can swim and run*). `but` também só entra nos conectores.

**Vocabulário por nível (só aviso).** Palavra acima do nível da playlist, ou desconhecida, vira **aviso** na frase, nunca rejeição. A lista é a CEFR-J (A1–B2, por lema). Se mais de 15% das frases aceitas tiverem aviso, a playlist também recebe um aviso. A lista é geral; **o que é específico de um tema vem sempre do contexto**: o `vocabulary` do arquivo do contexto é a única exceção (texto simples = liberado em qualquer nível; `{ word, from }` = liberado a partir de um nível). Assim, trocar de contexto (Java, culinária...) não exige mexer em código. Nomes próprios (com inicial maiúscula) nunca são checados. O prompt lista só as palavras do tema já liberadas no nível do tópico.

Além disso, **a playlist inteira** é checada: o tópico-alvo aparece em pelo menos X% das frases (ex.: o recurso introduzido), e nenhuma estrutura domina a lista (ex.: >30% começando por `I am`).

### 4.1 Rodadas, exclusão e balanceamento entre lotes

Um lote de ~40 frases não cobre a playlist, e lotes independentes se repetem e se desequilibram (no teste do tópico 1, 13% de duplicatas e estruturas e cenas com pouca cobertura). Por isso a geração é uma **série de rodadas** sobre um **estado** por playlist (`state.json`, em `PIPELINE_DATA_DIR/runs/...`), que guarda as frases já **aceitas**:

1. `build_prompt.py --state state.json --pool 130` monta o prompt do próximo lote. Sem estado ele é o prompt simples; com estado, acrescenta:
   - **Lista de exclusão** (seção 2.2): as frases já aceitas, que o modelo não pode repetir nem quase copiar.
   - **O que ainda falta** (seção 2.1): cada estrutura marcada `need N more` ou `enough`, as cenas abaixo da cota e as palavras repetidas demais (fora os nomes dos personagens).
2. O modelo gera o lote.
3. `validate.py --state state.json --update-state` valida o lote **contra o estado** (repetir uma frase anterior é duplicata) e soma as aceitas ao estado. Ele imprime a situação do pool, o que ainda falta e as cotas **travadas** (pedidas na rodada anterior e não preenchidas: provavelmente difíceis demais para o tópico, e não vale insistir).
4. Repete até o pool chegar a ~130 e as cotas fecharem, ou até um limite de rodadas (3, como no fluxo geral).
5. `select_final.py` escolhe as ~100 frases finais por **rodízio de estruturas** e, dentro delas, a cena **menos representada** primeiro, preferindo frases com estrutura confirmada, sem aviso de vocabulário e mais curtas. Se uma estrutura se esgota, as outras completam o total.

**Cotas** (`balance.py`): cada estrutura deve ter 70% da sua parte igual do pool e cada cena 60% (mais frouxo, porque cenas como o encerramento mal cabem em tópicos básicos). A contagem usa só estruturas **confirmadas** (declaradas pelo modelo e detectadas pela regra).

## 5. Juiz (etapa 3)

Ainda não escrito (fica para a etapa 3). Desenho: segundo passe com **outro modelo** e rubrica fixa, com saída estruturada:

- natural (um falante diria isso)?
- pratica o tópico-alvo?
- cabe no contexto?
- nível adequado para escuta (sem ambiguidade nem gíria)?
- uma nota de 1 a 5 por critério e um veredito `ok | rewrite | drop`.

Corte inicial: média ≥ 4 e nenhum critério < 3. Calibrar com 30 frases avaliadas à mão.

## 6. Prompt de geração

O prompt existe e é **montado por código**, não escrito à mão por tópico:

- Template versionado: [`pipeline/prompts/v1/generate.md`](../pipeline/prompts/v1/generate.md). Uma mudança de prompt vira `v2/`, e o `prompt_version` acompanha as frases geradas.
- Montador: [`pipeline/src/build_prompt.py`](../pipeline/src/build_prompt.py). Preenche o template com o currículo, o catálogo de recursos, [`feature-descriptions.yaml`](pipeline/feature-descriptions.yaml) e o arquivo do contexto ([`pipeline/contexts/`](../pipeline/contexts/)). Também gera o JSON schema da **resposta do modelo**.
- Uso: `python build_prompt.py --context ../contexts/entrevista-java.yaml --topic subject-pronouns-and-verb-to-be --count 40 --schema schema.json`.
- O `details` do contexto vem do banco (tabela `contexts`, pelo slug do YAML), então uma edição no backoffice vale no próximo prompt. A saída de erro mostra a origem e o sha256 do texto usado (guarde-o ao registrar a rodada); `--offline` força o YAML.

O que o prompt contém, nesta ordem:

1. **Papel e tarefa:** frases para treino de escuta, com nível, tópico e contexto.
2. **Regras de gramática:** (1.1) o baseline sempre permitido; (1.2) o que já foi ensinado, para usar à vontade; (1.3) a gramática-alvo do tópico; (1.4) tudo o que ainda não foi ensinado, para nunca usar. As listas saem dos `introduces` dos currículos, então o prompt e o validador usam a mesma fonte.
3. **Estruturas a cobrir:** todas as `structures` do tópico, com uma cota mínima por estrutura (70% das frases divididas entre elas) e instrução de não copiar os exemplos.
4. **Tema:** descrição, detalhes, cenas e vocabulário do contexto, com a regra de que **a gramática vence o tema**.
5. **Regras de forma:** faixa de palavras do nível, apóstrofo reto, números por extenso, sem símbolos, variedade de começos.
6. **Autoverificação e saída:** o modelo responde com `text`, `structure` e `scene` por frase.

Decisões de desenho que valem lembrar:

- Tudo em **inglês**: o prompt, a descrição dos recursos, os nomes dos tópicos e o contexto.
- A resposta pode ter **menos** frases que o pedido. O prompt manda não encher a lista com frase inválida só para fechar o número.
- O limite de frases com o mesmo começo é 25% do total, porque nos primeiros tópicos só há sete sujeitos possíveis.
- Em tópico de **revisão aprofundada**, a seção 1.3 pede mais variantes das estruturas já ensinadas.
- **Ainda não foi testado com um modelo.** O montador roda para os 50 tópicos, mas a qualidade das frases só aparece no protótipo da etapa 1.

## 7. Gravação no banco (etapa 4)

A pipeline conecta direto no Postgres (string de conexão por variável de ambiente) e grava só o que a seção 8.1 do documento lista. **Não** calcula `text_hash`, `char_count` nem `version` (triggers), e **não** mexe em `status`.

1. **Catálogo.** *Upsert* de `levels` (por `code`) e de `grammar_topics` (por `slug`) a partir dos currículos, com `sort_order` vindo do `order`. Cada tópico novo ganha, por trigger, uma playlist vazia (`draft`) em todos os contextos existentes. Mudar `sort_order` ou `level_id` de um tópico existente muda a ordem que o aluno vê; por isso essa atualização é explícita, nunca silenciosa.
2. **Contexto.** O contexto precisa **existir** (criado no backoffice, que também cria as playlists vazias dele). A pipeline só o lê. O texto livre (`details`) vale o do **banco**, editado no backoffice: `build_prompt.py` o lê pelo slug (`PIPELINE_DATABASE_URL`) e usa o do YAML só como plano B (`--offline` ou sem conexão). Cenas, personagens e vocabulário (com nível mínimo) não existem no banco e vivem no arquivo `contexts/*.yaml`.
3. **Playlist alvo.** Busca por `(grammar_topics.slug, contexts.slug)`.
4. **Proteção.** Por padrão, só grava em playlist `draft`. Em `published`, recusa, a menos que se passe um flag explícito: trocar as frases vale na hora para os alunos e zera o `last_sentence_id` de quem estava nas frases removidas. Uma playlist `draft` que já tem frases também exige o flag de substituição.
5. **Ordem e tamanho.** A playlist vem de `select_final.py` (~100 frases). A ordem é **agrupada por cena**, na ordem das cenas do contexto, como um roteiro; dentro da cena, as estruturas se alternam em rodízio e, em cada uma, as frases mais curtas vêm antes. `position` vai de 1 a n. Fora de 90 a 110 frases, avisa.
6. **Diff por hash, não apagar tudo.** O áudio gerado custa crédito e é reaproveitado pelo hash do texto normalizado. Por isso a pipeline compara com as frases já gravadas e, numa só transação, remove as que saíram, renumera as que ficaram e insere as novas. Frase com texto alterado vira áudio órfão (custa de novo); frase idêntica não. A renumeração cabe numa transação porque `UNIQUE (playlist_id, position)` é `DEFERRABLE`.
7. **Sem duplicatas.** Deduplica pelo texto normalizado antes do INSERT (ver seção 4).
8. **`metadata`.** Guarda `scene`, `structure`, `prompt_version`, o modelo e, se houver, as palavras com aviso de vocabulário (`vocab_flags`), para rastrear e reavaliar depois.
9. **Última linha de defesa.** O gravador não confia que o arquivo passou pelo `validate.py`: aplica de novo as regras de texto (URL, emoji, dígito, caractere invisível ou não-ASCII, pontuação final, faixa de palavras do nível) e recusa o arquivo inteiro se alguma frase falhar. Gramática e vocabulário continuam sendo do `validate.py`.
10. **Conferência antes do commit.** Depois de gravar, relê as frases no próprio banco e compara posições, textos e hashes com o esperado. Se algo divergir, desfaz tudo.

### 7.1 Implementação

- [`pipeline/src/write_db.py`](../pipeline/src/write_db.py): `python write_db.py --topic <slug> --context ../contexts/x.yaml --input final.json [--dry-run] [--replace] [--allow-published] [--update-catalog] [--model <id>]`. O **`--dry-run`** executa a gravação inteira, inclusive os triggers e as restrições do banco, e **desfaz no fim**: o relatório mostra exatamente o que aconteceria. Sem mudanças, nada é escrito e a `version` não sobe. Código de saída 2 em recusas esperadas.
- [`pipeline/src/create_pipeline_role.py`](../pipeline/src/create_pipeline_role.py): cria a role `pipeline_writer` com o mínimo de permissões e grava a URL de conexão (modo 600) em `PIPELINE_DATA_DIR/pipeline-db.env`, fora do git. Rodar como administrador: `python create_pipeline_role.py --admin-url postgres://...`. Re-executar só reaplica as permissões; `--rotate` troca a senha. A role **não é superusuária nem dona de tabelas** e só pode: ler contextos e playlists, criar e alterar níveis e tópicos, gravar frases, inserir playlists (trigger de tópico novo) e subir a coluna `version`. Usuários, tokens, configurações e progresso de alunos ficam inacessíveis. O script confere isso conectando como a role.
- Testes de integração (`test_write_db.py`, 21 casos) rodam contra um Postgres **descartável**, nunca o de desenvolvimento. Instruções no topo do arquivo.


## 8. Contexto como entrada

Arquivo pequeno por contexto, escrito à mão e todo em inglês. **A gramática vem do currículo; o tema vem daqui.** Exemplo real: [`pipeline/contexts/entrevista-java.yaml`](../pipeline/contexts/entrevista-java.yaml).

```yaml
slug: software-engineer-interview-java
name: Software engineer interview (Java)
category: Work
description: Technical and behavioural interview for a Java developer position.
details: >-          # opcional, igual ao campo `details` do contexto no backoffice
  ...
scenes:
  - { id: introduction, desc: "greetings and introducing yourself to the interviewer" }
vocabulary: [Java, Spring, code, project, team, manager, office, interview]
```

`vocabulary` é a exceção do filtro de léxico. Nos primeiros tópicos, o vocabulário do contexto aparece como nomes próprios, adjetivos e lugares, porque os substantivos comuns dependem de `a/an`, plural e `the`.

## 9. Tecnologia e estrutura

Python, por causa do spaCy. SDK da Anthropic com a **Batch API** para as etapas 1 e 3 (cerca de 50% mais barata; a latência não importa).

```
pipeline/
  curriculum/{a1,a2,b1,b2}.yaml  features.yaml     (hoje em docs/pipeline/)
  validator/{rules.py,analyze.py}                  (já existe)
  prompts/v1/generate.md  (juiz e regeneração: ainda não escritos)
  contexts/entrevista-java.yaml
  src/build_prompt.py validate.py vocab.py balance.py select_final.py fetch_cefrj.py write_db.py create_pipeline_role.py   (já existem; testes: test_*.py)
  src/ generate.py judge.py
  runs/<context>/<level>/<topic>/{candidates,validated,judged}.jsonl
```

## 9.1 Dados fora do repositório

Listas de terceiros e saídas das rodadas ficam **fora do git**, em `PIPELINE_DATA_DIR` (padrão: `pipeline-data/`, irmão da pasta do projeto, ou seja, `.worktrees/pipeline-data/`, que o `.gitignore` da raiz já ignora):

```
pipeline-data/
  cefrj/            CEFR-J Wordlist v1.6 (zip, xlsx, lemmas.json, ATTRIBUTION.txt)
  runs/<contexto>/<nível>/<tópico>/<versão do prompt>/   batches, prompt usado e relatório
```

`python fetch_cefrj.py` baixa a lista e gera `lemmas.json` (requer `openpyxl`).

**Fonte e licença.** CEFR-J Wordlist, https://www.cefr-j.org/download.html. A página diz que a lista "can be used for both research and commercial purposes with a proper acknowledgement of the source". Citação exigida: *The CEFR-J Wordlist Version 1.6. Compiled by Yukio Tono, Tokyo University of Foreign Studies.* Redistribuição **não é mencionada**, por isso o arquivo não é commitado. A versão japonesa da página acrescenta que, em uso comercial com supervisão da equipe, é preciso consultá-la antes. Oxford 3000/5000 e English Vocabulary Profile: termos **não confirmados**, não usados.

## 10. Decisões em aberto

1. Conferir a ordem dos quatro níveis (A1 decidida pelo professor; A2, B1 e B2 propostas) com o English Grammar Profile / CEFR-J.
2. Limiar de similaridade para duplicatas.
3. Corte do juiz (calibrar com amostra manual).
4. Cada estrutura foi validada com **um** exemplo. Falta um conjunto maior de frases (positivas e negativas) para medir a precisão real dos detectores, e algumas regras são largas (ver a seção "Regras largas" da análise).
5. Níveis da CEFR-J: ela foi feita para aprendizes japoneses e alguns níveis surpreendem (`friendly` = B2). Revisar com o professor, e registrar exceções no contexto se necessário.
6. Calibrar o ciclo de rodadas com dados reais: tamanho do lote, cotas (70% e 60%) e o limite de rodadas.
7. Como a conexão da pipeline chega ao Postgres de produção (rede local ou Tailscale). A role já existe (`create_pipeline_role.py`); falta só decidir o caminho de rede e onde guardar a URL fora da máquina de desenvolvimento.

## 11. Próximo passo

Protótipo mínimo de **uma unidade**: gerar o tópico 1 num contexto, rodar a validação spaCy e olhar as rejeições. Serve para provar que o prompt e o detector de gramática funcionam antes de investir no resto.
