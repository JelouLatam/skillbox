FROM oven/bun:1.3.1@sha256:9c5d3c92b234b4708198577d2f39aab7397a242a40da7c2f059e51b9dc62b408 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run typecheck && bun run build
FROM oven/bun:1.3.1@sha256:9c5d3c92b234b4708198577d2f39aab7397a242a40da7c2f059e51b9dc62b408 AS runtime-base
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/bootstrap ./bootstrap
COPY --from=build /app/cli ./cli
COPY --from=build /app/scripts ./scripts
COPY package.json LICENSE ./
RUN mkdir -p /app/data && chown bun:bun /app/data
ENV HOST=0.0.0.0 PORT=4791 NODE_ENV=production
EXPOSE 4791
FROM runtime-base AS fly
# Fly mounts volumes root-owned: fix ownership as root, then drop to `bun` for the server.
ENV SKILLBOX_DATA_DIR=/data/pglite HOME=/home/bun
CMD ["sh","-c","mkdir -p /data/pglite && chown -R bun:bun /data && exec setpriv --reuid=bun --regid=bun --init-groups bun src/server/index.ts"]
FROM runtime-base
USER bun
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD bun -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["bun","src/server/index.ts"]
