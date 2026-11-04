#!/bin/sh
# Writes the frame-ancestors policy at container start.
# FRAME_ANCESTORS lists the exact origins allowed to embed this app,
# separated by spaces (for example "https://dashboard.shellui.com").
# Each entry must be 'self' or an http(s) origin. A bare * is refused.
set -euf

OUT=/etc/nginx/snippets/frame-ancestors.conf
ORIGIN_RE='^https?://(\*\.)?[A-Za-z0-9.-]+(:[0-9]+)?$'

ancestors="${FRAME_ANCESTORS:-}"
if [ -z "$ancestors" ]; then
  echo "shellui: FRAME_ANCESTORS is not set, only same-origin framing is allowed" >&2
  ancestors="'self'"
fi

policy=""
for entry in $ancestors; do
  entry="${entry%/}"
  if [ "$entry" != "'self'" ] && ! printf '%s' "$entry" | grep -Eq "$ORIGIN_RE"; then
    echo "shellui: FRAME_ANCESTORS entry is not an http(s) origin: $entry" >&2
    exit 1
  fi
  policy="$policy $entry"
done

printf 'add_header Content-Security-Policy "frame-ancestors%s" always;\n' "$policy" > "$OUT"
