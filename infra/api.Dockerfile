FROM node:22-slim
RUN corepack enable
WORKDIR /app

# Manifestos primeiro, para aproveitar o cache da instalação.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --filter @reouvir/api... --no-frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
EXPOSE 3711
CMD ["pnpm", "start"]
