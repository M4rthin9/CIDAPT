FROM gotenberg/gotenberg:8.36.0

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig curl \
  && rm -rf /var/lib/apt/lists/*

COPY fonts/ /usr/share/fonts/truetype/cida/

RUN fc-cache -f

USER gotenberg

# Chromium's first cold start can exceed Gotenberg's 20s default on a loaded or
# slow host (observed on the Windows dev host: the first invoice render 500s
# with "websocket url timeout reached"). Raise the start and API timeouts so a
# cold boot renders instead of failing the first tax invoice after a deploy.
CMD ["gotenberg", "--chromium-start-timeout=120s", "--api-timeout=180s"]
