FROM gotenberg/gotenberg:8.36.0

USER root

RUN apt-get update \
  && apt-get install -y --no-install-recommends fontconfig curl \
  && rm -rf /var/lib/apt/lists/*

COPY fonts/ /usr/share/fonts/truetype/cida/

RUN fc-cache -f

USER gotenberg
