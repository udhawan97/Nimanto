FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS base

ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@11.20.0 --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/documents/package.json packages/documents/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/parsers/package.json packages/parsers/package.json
COPY packages/providers/package.json packages/providers/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY tokens.css tokens.css
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/
COPY apps/web/app apps/web/app
COPY apps/web/components apps/web/components
COPY apps/web/lib apps/web/lib
COPY apps/web/public apps/web/public
COPY apps/web/next-env.d.ts apps/web/next.config.ts apps/web/tsconfig.json apps/web/
COPY apps/worker/src apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/tsconfig.build.json apps/worker/
COPY packages/database/src packages/database/src
COPY packages/database/tsconfig.json packages/database/tsconfig.build.json packages/database/
COPY packages/documents/src packages/documents/src
COPY packages/documents/tsconfig.json packages/documents/tsconfig.build.json packages/documents/
COPY packages/domain/src packages/domain/src
COPY packages/domain/tsconfig.json packages/domain/tsconfig.build.json packages/domain/
COPY packages/parsers/src packages/parsers/src
COPY packages/parsers/tsconfig.json packages/parsers/tsconfig.build.json packages/parsers/
COPY packages/providers/src packages/providers/src
COPY packages/providers/tsconfig.json packages/providers/tsconfig.build.json packages/providers/
RUN pnpm build
RUN mkdir -p /runtime/apps/api /runtime/apps/web /runtime/apps/worker \
      /runtime/packages/database /runtime/packages/documents /runtime/packages/domain \
      /runtime/packages/parsers /runtime/packages/providers \
    && cp package.json pnpm-lock.yaml pnpm-workspace.yaml /runtime/ \
    && cp -a node_modules /runtime/node_modules \
    && cp apps/api/package.json /runtime/apps/api/ \
    && cp -a apps/api/dist /runtime/apps/api/ \
    && if [ -d apps/api/node_modules ]; then cp -a apps/api/node_modules /runtime/apps/api/; fi \
    && cp apps/web/package.json /runtime/apps/web/ \
    && cp -a apps/web/out /runtime/apps/web/ \
    && if [ -d apps/web/node_modules ]; then cp -a apps/web/node_modules /runtime/apps/web/; fi \
    && cp apps/worker/package.json /runtime/apps/worker/ \
    && cp -a apps/worker/dist /runtime/apps/worker/ \
    && if [ -d apps/worker/node_modules ]; then cp -a apps/worker/node_modules /runtime/apps/worker/; fi \
    && for package in database documents domain parsers providers; do \
         cp "packages/$package/package.json" "/runtime/packages/$package/"; \
         cp -a "packages/$package/dist" "/runtime/packages/$package/"; \
         if [ -d "packages/$package/node_modules" ]; then \
           cp -a "packages/$package/node_modules" "/runtime/packages/$package/"; \
         fi; \
       done

FROM base AS runtime
ENV NODE_ENV=production
ENV NIMANTO_API_HOST=0.0.0.0
ENV NIMANTO_API_PORT=4310
ENV NIMANTO_WEB_ORIGIN=http://127.0.0.1:4300
ENV NIMANTO_DATA_DIR=/data
ENV NIMANTO_DEMO_MODE=off
ENV NIMANTO_EXTERNAL_ACTIONS_ENABLED=off
COPY --from=build --chown=node:node /runtime /app
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4300 4310
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:4310/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["pnpm", "start:all"]
