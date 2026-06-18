# ── Custom Gotenberg 8 image with Thai fonts baked in ────────────────────────
# Why this exists (Phase 1.5 hard constraint — "Thai font support is mandatory"):
# the default gotenberg/gotenberg:8 image has no Thai font, so the invoice
# template used to pull Sarabun from Google Fonts at render time and rely on a
# 1s waitDelay. That is fragile (network in the render path) and slow. Here we
# install Sarabun ONCE at build time; rendering is then fully offline and the
# waitDelay can be removed.
FROM gotenberg/gotenberg:8

USER root

# Sarabun is the Google-recommended Thai UI font (OFL-licensed). We vendor the
# four weights the template uses (400/500/600/700) from the official google/fonts
# repo at build time and register them with fontconfig.
#
# Pinned to a commit SHA for reproducibility — bump deliberately, never float on
# a branch. The default below is an intentionally INVALID placeholder so an
# unconfigured build fails loudly instead of silently pulling the wrong bytes.
# Set a real SHA from https://github.com/google/fonts/commits/main/ofl/sarabun
# (verify the four static weights still live at ofl/sarabun/Sarabun-<W>.ttf —
# Google sometimes ships only the variable font, in which case vendor the TTFs
# into ./fonts and swap the curl loop for a COPY for a fully air-gapped build).
ARG GOOGLE_FONTS_SHA=SET-ME-TO-A-REAL-google-fonts-commit-sha
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends curl ca-certificates fontconfig; \
    mkdir -p /usr/share/fonts/truetype/sarabun; \
    for w in Regular Medium SemiBold Bold; do \
      curl -fsSL \
        "https://raw.githubusercontent.com/google/fonts/${GOOGLE_FONTS_SHA}/ofl/sarabun/Sarabun-${w}.ttf" \
        -o "/usr/share/fonts/truetype/sarabun/Sarabun-${w}.ttf"; \
    done; \
    fc-cache -f; \
    fc-list | grep -i sarabun; \
    apt-get purge -y curl; \
    apt-get autoremove -y; \
    rm -rf /var/lib/apt/lists/*

# Gotenberg's runtime user (unprivileged) — restore it after the root install.
USER gotenberg
