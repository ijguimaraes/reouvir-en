---
name: design-typography
description: Use ao definir tamanhos, pesos, medida de linha, fontes ou hierarquia de texto no Reouvir EN. Escala por papel, legibilidade em movimento e carregamento sem salto.
---

# Tipografia

O app é um instrumento de uso, não uma página de marketing. Estabilidade e legibilidade valem mais que expressão.

## Escolhas

- **Uma família basta.** Hoje `system-ui, sans-serif`. Só adicione uma segunda família se ela tiver um papel que a primeira não cumpre.
- Se adicionar fonte web: hospede localmente (PWA offline), carregue só os pesos usados, `font-display: swap` e um fallback com métricas próximas para não haver salto de layout.
- **Monoespaçada só para código e dados** (ex.: o `textarea` do admin), nunca como fantasia "técnica".

## Escala por papel

Defina papéis, não tamanhos soltos. Valores em `rem`. Escala **fixa** (sem `clamp()` nos textos de interface); razão de 1,125 a 1,2 entre passos.

| Papel | Uso | Referência |
|---|---|---|
| `display` | Frase atual do player | grande, 1,5 a 1,75rem, legível a distância de braço |
| `title` | Título de tela | 1,25rem |
| `body` | Texto corrido, itens de lista | 1rem (piso de 16px) |
| `label` | Rótulos de campo, botões | 0,875rem, peso 500–600 |
| `meta` | Contagens, badges, apoio | 0,75 a 0,8125rem, só para informação secundária |

Texto de leitura nunca abaixo de 14px. Não use 11px para nada que o aluno precise ler em movimento (o piso hoje é `--text-meta`, 13px).

## Regras

1. **Medida:** 45 a 75 caracteres por linha em texto corrido. A frase do player é curta, mas deve ser centralizada e quebrar bem.
2. **Altura de linha** inversamente proporcional à largura: corpo 1,5; título 1,2 a 1,3. No tema escuro, +0,05 e, se preciso, um passo de peso.
3. **Quebra de linha:** `text-wrap: balance` em títulos e na frase do player; `text-wrap: pretty` no corpo. Ambos degradam sem prejuízo.
4. **Hierarquia por mais de um eixo:** tamanho + peso + cor (`--text` vs `--text-muted`) + espaço. Tamanho sozinho não basta.
5. **Caixa-alta com tracking** só para rótulos curtos de seção. Evite em todo título e subtítulo, e não adicione rótulo "kicker" acima de títulos.
6. **Não destaque uma palavra solta** num título com cor ou itálico por enfeite.
7. **Números tabulares** (`font-variant-numeric: tabular-nums`) em tempos, contagens e colunas de tabela, para não tremer.
8. **Tracking** entre −0,02em e 0 em títulos grandes. Não passe de −0,04em.
9. Respeite zoom do navegador e tamanho de fonte do sistema. Sem `maximum-scale` no viewport.

## Texto de interface (UX writing)

- Botão diz a ação: "Baixar playlist", não "OK". O toast repete o verbo: "Playlist baixada".
- Erro diz o que houve e como resolver. Não pede desculpas.
- Estado vazio convida a agir.
- Português do Brasil, com acentuação correta, frase em caixa de sentença.

## Verificação

Com o texto real de cada tela, em 360px e com fonte do sistema a 200%: nada corta, sobrepõe nem exige rolagem horizontal.
