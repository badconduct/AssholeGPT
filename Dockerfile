FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
WORKDIR /app
ARG VCS_REF=unknown
ARG SOURCE_URL=https://github.com/badconduct/AssholeGPT
LABEL org.opencontainers.image.revision=$VCS_REF org.opencontainers.image.source=$SOURCE_URL
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server.js LICENSE ./
COPY --chown=node:node lib ./lib
COPY --chown=node:node public ./public
RUN mkdir -p /app/data/saves && chown -R node:node /app/data
USER node
ENV HOST=0.0.0.0 PORT=3084 SAVE_DIR=/app/data/saves
EXPOSE 3084
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
