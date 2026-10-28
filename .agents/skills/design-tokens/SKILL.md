---
name: design-tokens
description: Use ao criar ou alterar cor, espaçamento, raio, sombra, z-index ou duração no Reouvir EN. Define os tokens CSS como fonte única compartilhada entre web e admin.
---

# Design tokens

Todo valor visual repetido vira variável CSS. Componentes consomem tokens, nunca valores soltos.

## Onde vivem

`packages/shared/src/theme.css`, importado por `apps/web/src/styles.css` e `apps/admin/src/styles.css`. Adicione tokens ali, não nos apps.

## Estado atual

`theme.css` já tem cor (inclui `--surface-2`, `--border-strong`, `--success`, `--warning`), tipografia, espaço, raio, movimento, camadas e `--tap-min`. `base.css` traz reset, foco, controles, badges e esqueleto, e é importado pelos dois apps. Os CSS dos apps não têm cor solta.

Ao tocar em CSS, mantenha assim: valor novo vira token em `theme.css`, nunca literal no app. Sombra ainda não tem token (o produto usa só borda); crie um se for preciso.

`--border-strong` é para o limite de campos e controles (contraste ≥ 3:1). `--border` é só divisória decorativa.

## Tokens a manter

Dois níveis. Os nomes descrevem o papel, nunca o valor (`--accent`, não `--blue`).

- **Cor (semântica):** `--bg --surface --surface-2 --text --text-muted --border --accent --accent-text --danger --success --warning`. Cada um com valor nos dois temas (ver `design-theming`).
- **Espaço:** escala de base 4. `--space-1: 4px`, `2: 8px`, `3: 12px`, `4: 16px`, `5: 24px`, `6: 32px`, `7: 48px`. Use `gap` entre irmãos.
- **Raio:** `--radius-sm: 8px` (campo, botão), `--radius-md: 12px` (cartão), `--radius-full: 99px` (badge, controle redondo). Um raio por papel, não um para tudo.
- **Elevação:** declare uma vez, borda **ou** sombra. Borda de 1px sob sombra larga é cartão "fantasma". Sombra tem deslocamento e desfoque suave.
- **Movimento:** `--dur-fast: 120ms`, `--dur-base: 200ms`, `--dur-slow: 350ms`, `--ease-out: cubic-bezier(.16, 1, .3, 1)`.
- **Camadas:** `--z-sticky`, `--z-overlay`, `--z-toast`. Nunca `z-index: 9999`.
- **Alvo de toque:** `--tap-min: 44px`.

## Regras

1. Antes de escrever um valor, procure um token. Se não existe e vai se repetir 3 vezes ou mais com a mesma intenção, crie. Se é de uso único, não crie.
2. Não crie token para cada número. Token tem significado.
3. Dois botões parecidos com intenções diferentes continuam separados.
4. Ao criar token de cor, defina o par claro e o escuro no mesmo commit.
5. Texto de interface em `rem`, não em px, para respeitar a configuração de fonte do usuário. Medidas de borda e sombra podem ficar em px.

## Verificação

- `grep -nE '#[0-9a-fA-F]{3,8}' apps/*/src/*.css` não encontra cor fora de `theme.css`.
- Mudar um token no `theme.css` altera web e admin juntos.
