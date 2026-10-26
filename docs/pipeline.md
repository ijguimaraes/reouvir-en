# Pipeline de geração de frases

> Rascunho de desenho. A pipeline é um **projeto à parte** (decisão do `AGENTS.md`); este documento fica aqui só para guiar o formato de entrega. Se virar outro repositório, mova-o junto.

## 1. Objetivo

Produzir, por **contexto**, o JSON aninhado da seção 8 de [`estrutura-do-projeto.md`](estrutura-do-projeto.md) (contexto → níveis → tópicos → frases), com ~100 frases por playlist, respeitando a regra: **nenhuma frase usa gramática de um tópico posterior**.

A pipeline é dona da pedagogia (ordem dos tópicos, regras de gramática, prompts, modelo). O app só valida o formato e importa como `draft`.

## 2. Fluxo

```
curriculum-*.yaml ─┐
contexto (yaml)  ──┼─► 1 Gerar ─► 2 Validar (código) ─► 3 Juiz (LLM) ─► 4 Montar ─► 5 Revisar
vocabulário CEFR ──┘      │              │                    │             JSON         (humano)
                          └──── reprova ─┴──── reprova ───────┘
                               regenera só as frases reprovadas (máx. 3 rodadas)
```

Uma unidade de trabalho é `(contexto, nível, tópico)`. Cada etapa lê e grava JSONL em disco, é idempotente e retomável (pula o que já existe com o mesmo hash de entrada).

| # | Etapa | Entrada → saída | LLM? |
|---|---|---|---|
| 1 | Gerar | currículo + contexto → `candidates.jsonl` (~130 por tópico) | sim |
| 2 | Validar | candidatas → `validated.jsonl` + motivos de rejeição | não |
| 3 | Juiz | aprovadas pelo passo 2 → notas e veredito | sim (outro modelo) |
| 4 | Montar | aprovadas, ordenadas → JSON de importação | não |
| 5 | Revisar | amostra de 10–20% por playlist + todas as de alerta | humano |

## 3. Currículo

Fica em arquivos declarativos, **agnósticos a contextos** (só gramática e nível; exemplos neutros do dia a dia), um por nível: [A1](pipeline/curriculum-a1.yaml), [A2](pipeline/curriculum-a2.yaml), [B1](pipeline/curriculum-b1.yaml) e [B2](pipeline/curriculum-b2.yaml). O catálogo de recursos gramaticais, com a regra spaCy de cada um, é [`pipeline/features.yaml`](pipeline/features.yaml).

- Cada tópico declara o que **introduz** (`introduces`) e as **estruturas** que a playlist deve cobrir (`structures`, cada uma com regra spaCy e frase de exemplo).
- A ordem gramatical é **cumulativa entre níveis** (A1 → A2 → B1 → B2): o permitido num tópico é o `baseline` mais tudo o que os tópicos anteriores introduziram. O **proibido é derivado** (todo recurso do catálogo ainda não introduzido); não é escrito à mão.
- Um assunto pode reaparecer em nível acima, com mais profundidade: o tópico novo tem slug próprio e `deepens` aponta o anterior (ex.: `question-words` aprofunda o `wh + be` do A1).
- `added: true` marca tópicos que não estão no seed do documento e entram como pré-requisito (`was/were`, possessivos `'s`/`mine`).

`level.code`, `topic.slug`, `topic.name` e `topic.order` vão direto para o JSON de importação, então o catálogo do app e o currículo nunca divergem.

## 4. Validação determinística (etapa 2)

Roda com spaCy (`en_core_web_sm` basta). Uma frase é **rejeitada** se:

- usa qualquer recurso do catálogo (`features.yaml`) que ainda não foi introduzido naquele ponto do currículo;
- tem palavras fora da faixa do nível (A1: 4–10);
- contém dígito, emoji, URL ou abreviação (o TTS lê mal);
- repete outra frase da playlist (texto normalizado) ou fica muito parecida (embedding, limiar a calibrar);
- tem palavra fora da lista do nível (Oxford 3000/5000, CEFR-J), exceto nomes próprios e termos do contexto (`context.vocabulary`);

**O validador já existe** em [`pipeline/validator/`](../pipeline/validator/) (`rules.py` é a DSL das regras, `analyze.py` roda a análise). Ele valida os próprios currículos: cada estrutura precisa ser detectada pela regra no seu exemplo, caber na faixa de palavras e não usar recurso posterior. O resultado está em [`pipeline/analise-estruturas.md`](pipeline/analise-estruturas.md), regerado por `python analyze.py ../../docs/pipeline ../../docs/pipeline/analise-estruturas.md` (requer `pip install -r requirements.txt` e `python -m spacy download en_core_web_sm`).

Além disso, **a playlist inteira** é checada: o tópico-alvo aparece em pelo menos X% das frases (ex.: o recurso introduzido), e nenhuma estrutura domina a lista (ex.: >30% começando por `I am`).

## 5. Juiz (etapa 3)

Segundo passe com **outro modelo** e rubrica fixa, saída em JSON:

- natural (um falante diria isso)?
- pratica o tópico-alvo?
- cabe no contexto?
- nível adequado para escuta (sem ambiguidade nem gíria)?
- uma nota de 1 a 5 por critério e um veredito `ok | rewrite | drop`.

Corte inicial: média ≥ 4 e nenhum critério < 3. Calibrar com 30 frases avaliadas à mão.

## 6. Rascunho do prompt de geração

Versionado (`prompt_version` vai em `source` no JSON). Esqueleto:

```
Você escreve frases em inglês para treino de ESCUTA, nível {level}.
Contexto: {context.name}. {context.description}
Tópico-alvo: {topic.name}.

REGRAS DE GRAMÁTICA
- Pode usar: {baseline + introduces acumulado, em linguagem simples}
- Proibido usar: {forbids}. Não use nenhuma estrutura além das permitidas.
- Predicados permitidos neste tópico: {topic.predicates}

REGRAS DE FORMA
- {min}–{max} palavras, uma frase por item, sem números em dígitos, sem emojis.
- Frases naturais, variadas (não repita o mesmo começo mais de {n} vezes).
- Cubra estas cenas do contexto: {context.scenes}.

BONS EXEMPLOS (neutros, do currículo): {topic.good}
MAUS EXEMPLOS (e por quê): {topic.bad}
EXEMPLOS DO CONTEXTO (opcional): {context.examples_by_topic[topic.slug]}
VOCABULÁRIO DO CONTEXTO (use livremente dentro das regras de gramática): {context.vocabulary}

Devolva {N} frases no schema: [{ "text": "...", "scene": "..." }]
```

Usar saída estruturada (JSON schema). Gerar em lotes de ~40, com temperatura moderada, para variar sem perder o controle.

## 7. Montagem (etapa 4)

- Ordena as frases sobreviventes (progressão leve: curtas e simples primeiro, ou agrupadas por `scene`) e numera de 1 a n.
- Corta em ~100; se sobrar menos de 90, a playlist volta para a geração.
- Preenche `source` (pipeline, versão, data, modelo, `prompt_version`) e a hierarquia `context → levels → topics → sentences`.
- **Valida o arquivo final contra o schema do app** (zod de `packages/shared`, exportado como JSON Schema se a pipeline não for TypeScript) antes de entregar.

## 8. Contexto como entrada

Arquivo pequeno por contexto, escrito à mão. **A gramática vem do currículo; o tema vem daqui** (cenas, vocabulário e, se quiser, exemplos próprios):

```yaml
slug: entrevista-de-engenheiro-de-software-java
name: Entrevista de engenheiro de software (Java)
category: Trabalho
description: Entrevista técnica e comportamental para vaga de desenvolvedor Java.
scenes: [introduction, opening, experience, technical_questions, soft_skills, closing]
vocabulary: [Java, Spring, team, project, code, interview, manager, office]
examples_by_topic:            # opcional; entram no prompt além dos exemplos neutros do currículo
  pronomes-e-verbo-to-be: ["I'm nervous today.", "Carlos is friendly."]
```

`vocabulary` é a exceção do filtro de léxico. Nos primeiros tópicos, o vocabulário do contexto aparece como nomes próprios, adjetivos e lugares, porque os substantivos comuns dependem de `a/an`, plural e `the`.

## 9. Tecnologia e estrutura

Python, por causa do spaCy. SDK da Anthropic com a **Batch API** para as etapas 1 e 3 (cerca de 50% mais barata; a latência não importa).

```
pipeline/
  curriculum/{a1,a2,b1,b2}.yaml  features.yaml     (hoje em docs/pipeline/)
  validator/{rules.py,analyze.py}                  (já existe)
  contexts/entrevista-java.yaml
  prompts/v1/generate.md  judge.md
  src/ generate.py validate.py judge.py assemble.py
  runs/<context>/<level>/<topic>/{candidates,validated,judged}.jsonl
  out/<context>.json
```

## 10. Decisões em aberto

1. Conferir a ordem dos quatro níveis (A1 decidida pelo professor; A2, B1 e B2 propostas) com o English Grammar Profile / CEFR-J.
2. Limiar de similaridade para duplicatas.
3. Teto das exceções `soft` e corte do juiz (calibrar com amostra manual).
4. Cada estrutura foi validada com **um** exemplo. Falta um conjunto maior de frases (positivas e negativas) para medir a precisão real dos detectores, e algumas regras são largas (ver a seção "Regras largas" da análise).
5. O exemplo `exemplo-importacao.json` usa `a/an` e `the` no tópico 1; é só ilustração do formato, mas não segue esta regra. Ajustar se quiser que seja coerente.

## 11. Próximo passo

Protótipo mínimo de **uma unidade**: gerar o tópico 1 num contexto, rodar a validação spaCy e olhar as rejeições. Serve para provar que o detector de gramática funciona antes de investir no resto.
