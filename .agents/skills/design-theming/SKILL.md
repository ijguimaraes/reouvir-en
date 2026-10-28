---
name: design-theming
description: Use ao mexer em tema claro/escuro ou em qualquer cor semântica do Reouvir EN. Cobre variáveis CSS, alternância manual, contraste por tema e ausência de flash na carga.
---

# Tema claro e escuro

Os dois apps seguem o sistema (`prefers-color-scheme`) e têm alternância manual. Tudo é feito com variáveis CSS, sem biblioteca.

## Como está montado

`packages/shared/src/theme.css`:

- `:root` define o tema claro e `color-scheme: light dark`.
- `@media (prefers-color-scheme: dark)` com `:root:not([data-theme="light"])` aplica o escuro automático.
- `:root[data-theme="dark"]` e `[data-theme="light"]` forçam a escolha manual.

Ao adicionar um token de cor, ele precisa existir **nos três blocos** (claro, escuro automático, escuro manual). Esquecer um deles quebra o tema sem erro.

## Regras

1. **Cor semântica, não literal.** Componente usa `--text-muted`, nunca `#5d6675`.
2. **Escuro não é o claro invertido.** Fundo escuro não é preto puro (hoje `#101216`). Cores de destaque ficam mais claras no escuro (`--accent` passa de `#3b5bdb` para `#748ffc`) e o texto sobre elas inverte (`--accent-text`).
3. **Contraste em cada tema, separadamente.** Texto normal ≥ 4,5:1, texto grande e ícones ≥ 3:1. Meça nos dois. Um token que passa no claro pode falhar no escuro.
4. **Cor nunca é o único sinal.** Estado (erro, sucesso, silêncio) também tem texto ou ícone.
5. **Texto sobre superfície colorida** deriva do matiz da superfície ou usa o token `-text` do par. Nunca cinza genérico.
6. **Sem flash na carga.** Aplique `data-theme` ao `<html>` antes da primeira pintura (script inline curto no `index.html` lendo `localStorage`, com `try/catch`). Sem isso, quem escolheu escuro vê um clarão.
7. **`color-scheme`** deve refletir o tema ativo, para que scrollbars, campos nativos e seleção acompanhem.
8. Imagens e ícones: SVG com `currentColor`. Evite PNG com fundo.

## Superfícies

Hierarquia por camadas, não por borda: `--bg` (página) → `--surface` (cartão, campo) → `--surface-2` (item realçado ou hover). No escuro, mais alto = ligeiramente mais claro.

## Verificação

- Alternar claro → escuro → sistema nos dois apps, em todas as telas, sem texto ilegível.
- Recarregar com escuro salvo: sem clarão.
- Tema do sistema alterado com o app aberto: o modo "sistema" acompanha.
