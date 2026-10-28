---
name: design-components
description: Use ao criar ou revisar botão, campo, lista, cartão, badge, controle ou qualquer componente do Reouvir EN. Garante vocabulário consistente e todos os estados.
---

# Componentes e estados

Vocabulário visual único nos dois apps. O mesmo papel tem a mesma forma em todo lugar.

## Inventário atual (CSS puro, classes)

`button` e `a.btn` (+ `.primary`, `.link`, `.big`, `.danger`), `.skeleton`, `useConfirm` e `TableWrap` no admin, `SkeletonList` e `RetryError` no web, `input/select/textarea`, `.card`, `a.item`, `.badge`, `.row`, `.controls`, `.bar`, `.toggle`, `.kv`, `table`. Antes de criar um componente novo, veja se algum deles resolve.

## Todo componente interativo tem

Padrão, `:hover` (só em `@media (hover: hover)`), `:focus-visible`, `:active`, `:disabled`, carregando e erro. Entregar só o "caminho feliz" é incompleto.

| Estado | Regra |
|---|---|
| Foco | Anel visível e consistente: `outline: 2px solid var(--accent); outline-offset: 2px` em `:focus-visible`. Nunca `outline: none` sem substituto. Já definido em `base.css` (`:focus-visible`). |
| Desabilitado | Não depender só de `opacity: .5`. Mantenha contraste legível, `cursor: not-allowed`, e `aria-disabled` quando precisar manter o foco. |
| Carregando | Esqueleto no lugar do conteúdo, ou botão com texto de progresso. Evite spinner no meio da tela. |
| Vazio | Diz o que fazer ("Nenhuma playlist baixada. Baixe uma para ouvir offline."). |
| Erro | Perto do campo, em texto, com o que corrigir. Cor + texto/ícone. |

## Regras por componente

- **Botão:** um primário por tela. Altura mínima do alvo = `--tap-min`. Ícone puro tem `aria-label`. Ação destrutiva se distingue por texto e posição, não só por vermelho.
- **Campo:** `<label>` sempre visível (não só placeholder). Tipo certo (`email`, `password`, `inputmode`), `autocomplete`, 16px no mínimo no celular (abaixo disso o iOS dá zoom ao focar).
- **Lista/linha clicável:** a linha inteira é o alvo, com foco e estado ativo. Item atual se marca por mais de cor (peso, marcador).
- **Cartão:** use para o que é, de fato, uma unidade (playlist, contexto). Não para agrupar tudo. Nunca aninhado.
- **Badge:** informação curta de estado, com texto. `offline`, `publicada`, `rascunho`.
- **Ícones:** biblioteca única ou SVG próprio, mesmo traço e tamanho. Sem emoji nem glifos Unicode no lugar de ícone (os ícones do app do aluno estão em `apps/web/src/components/Icons.tsx`, SVG com `currentColor`; reuse).
- **Modal:** último recurso. Prefira inline, painel expansível ou página. Quando for modal, use `<dialog>`, devolva o foco ao fechar.
- **Menus/overlays** não podem ser cortados por `overflow: hidden` do pai (`<dialog>`, popover API ou `position: fixed`).

## Superfícies que o navegador desenha

Estilize com os tokens: cor de seleção de texto (`::selection`), `accent-color` em checkbox e range, cursor/caret (`caret-color`), barra de rolagem fina, `color-scheme` para campos nativos.

## Antes de extrair um componente

Só se repetir 3 vezes ou mais com a mesma intenção. Duplicação é melhor que abstração prematura.

## Verificação

Para cada componente novo, percorra a tabela de estados com teclado (Tab, Enter, Espaço, Esc) e com toque.
