FROM alpine:3.23.5

# pg_dump for the database dump, curl+wget for tooling, mc for the MinIO mirror,
# restic for the offsite repository. All pinned (no :latest).
RUN apk add --no-cache \
    postgresql16-client=16.15-r0 \
    curl=8.20.0-r0 \
    ca-certificates=20260611-r0 && \
    curl -fsSL -o /usr/local/bin/mc https://dl.min.io/client/mc/release/linux-amd64/mc && \
    chmod +x /usr/local/bin/mc && \
    curl -fsSL -o /tmp/restic.bz2 https://github.com/restic/restic/releases/download/v0.18.0/restic_0.18.0_linux_amd64.bz2 && \
    bunzip2 -c /tmp/restic.bz2 > /usr/local/bin/restic && \
    chmod +x /usr/local/bin/restic && \
    rm -f /tmp/restic.bz2 && \
    mc --version && restic version

COPY crontab /etc/crontabs/root
COPY scripts/ /opt/backup
RUN chmod +x /opt/backup/run.sh && mkdir -p /backups/db /backups/media

ENTRYPOINT ["crond", "-f", "-l", "8"]
