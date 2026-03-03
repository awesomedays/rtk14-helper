#!/bin/bash
# RTK14Helper - SessionStart Hook
# 원격(Claude Code on Web) 환경에서만 실행

set -euo pipefail

# 원격 환경이 아니면 스킵
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# 프록시 설정: GLOBAL_AGENT_HTTP_PROXY → HTTPS_PROXY/HTTP_PROXY
if [ -n "${GLOBAL_AGENT_HTTP_PROXY:-}" ]; then
  export HTTPS_PROXY="$GLOBAL_AGENT_HTTP_PROXY"
  export HTTP_PROXY="$GLOBAL_AGENT_HTTP_PROXY"
fi

# ── gh CLI 설치 ──────────────────────────────────────────────
if ! command -v gh &> /dev/null; then
  echo "[session-start] gh CLI를 설치합니다..."

  LATEST=$(curl -s "https://api.github.com/repos/cli/cli/releases/latest" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])" 2>/dev/null \
    || echo "v2.87.3")
  VERSION="${LATEST#v}"

  cd /tmp
  curl -L -o gh_linux_amd64.tar.gz \
    "https://github.com/cli/cli/releases/download/${LATEST}/gh_${VERSION}_linux_amd64.tar.gz"
  tar -xzf gh_linux_amd64.tar.gz
  cp "gh_${VERSION}_linux_amd64/bin/gh" /usr/local/bin/gh
  chmod +x /usr/local/bin/gh
  cd -

  echo "[session-start] gh CLI 설치 완료: $(gh --version | head -1)"
else
  echo "[session-start] gh CLI 이미 설치됨: $(gh --version | head -1)"
fi

# ── GH_TOKEN으로 인증 ────────────────────────────────────────
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

if [ -n "$TOKEN" ]; then
  echo "[session-start] GH_TOKEN으로 gh CLI 인증합니다..."
  echo "$TOKEN" | gh auth login --with-token
  echo "[session-start] 인증 완료"
  gh auth status
else
  echo "[session-start] 경고: GH_TOKEN이 설정되어 있지 않습니다."
  echo "[session-start] Claude Code on Web 시크릿 설정에서 GH_TOKEN을 추가하세요."
fi

# CLAUDE_ENV_FILE에 프록시 환경변수 영속화
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export HTTPS_PROXY=\"${GLOBAL_AGENT_HTTP_PROXY:-}\"" >> "$CLAUDE_ENV_FILE"
  echo "export HTTP_PROXY=\"${GLOBAL_AGENT_HTTP_PROXY:-}\"" >> "$CLAUDE_ENV_FILE"
fi
