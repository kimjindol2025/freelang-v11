#!/bin/bash
# install.sh — dclub-auth 1-shot 설치 스크립트 (Ubuntu/Debian)
#
# 전제:
#   - root 또는 sudo 권한
#   - /opt/dclub-auth 에 코드 복사돼 있음 (이 스크립트가 있는 경로의 부모의 부모)
#   - Node.js 18+ 설치됨
#   - nginx 설치됨
#   - certbot 설치됨 (--nginx 플러그인 포함)
#   - DNS A/AAAA: auth.dclub.kr → 이 서버 IP
#
# 실행:
#   sudo bash projects/dclub-auth/deploy/install.sh

set -euo pipefail

DOMAIN="${DCLUB_AUTH_DOMAIN:-auth.dclub.kr}"
INSTALL_DIR="${DCLUB_AUTH_INSTALL_DIR:-/opt/dclub-auth}"
DATA_DIR="/var/lib/dclub-auth"
LOG_DIR="/var/log/dclub-auth"
ETC_DIR="/etc/dclub-auth"

if [ "$EUID" -ne 0 ]; then
  echo "ERROR: root 권한 필요. sudo 로 실행하세요."
  exit 1
fi

# ── 1. 사용자 + 디렉터리 ────────────────────────────
echo "[1/8] 사용자·디렉터리 생성"
id -u dclub-auth >/dev/null 2>&1 || useradd -r -s /bin/false -d /var/lib/dclub-auth dclub-auth
mkdir -p "$DATA_DIR" "$LOG_DIR" "$ETC_DIR" "$DATA_DIR/outbox"
chown -R dclub-auth:dclub-auth "$DATA_DIR" "$LOG_DIR"
chmod 750 "$DATA_DIR" "$LOG_DIR"

# ── 2. 환경 파일 ────────────────────────────────────
echo "[2/8] 환경 파일 (/etc/dclub-auth/env)"
if [ ! -f "$ETC_DIR/env" ]; then
  cp "$INSTALL_DIR/projects/dclub-auth/deploy/env.example" "$ETC_DIR/env"
  chown dclub-auth:dclub-auth "$ETC_DIR/env"
  chmod 600 "$ETC_DIR/env"
  echo "  ✓ $ETC_DIR/env (template) — SMTP 등 추가 시 편집"
else
  echo "  • 이미 존재 — 건너뜀"
fi

# ── 3. 코드 권한 ────────────────────────────────────
echo "[3/8] $INSTALL_DIR 권한"
chown -R dclub-auth:dclub-auth "$INSTALL_DIR"

# ── 4. systemd unit ─────────────────────────────────
echo "[4/8] systemd"
cp "$INSTALL_DIR/projects/dclub-auth/deploy/dclub-auth.service" /etc/systemd/system/dclub-auth.service
systemctl daemon-reload

# ── 5. 서비스 시작 (먼저, nginx 가 백엔드 확인 가능하도록) ──
echo "[5/8] dclub-auth 서비스 시작"
systemctl enable dclub-auth
systemctl restart dclub-auth
sleep 2

# 헬스체크
if curl -sf "http://127.0.0.1:30100/health" >/dev/null; then
  echo "  ✓ /health OK"
else
  echo "  ✗ /health 실패 — journalctl -u dclub-auth -n 50 확인"
  exit 1
fi

# ── 6. nginx ────────────────────────────────────────
echo "[6/8] nginx 사이트 설정"
cp "$INSTALL_DIR/projects/dclub-auth/deploy/nginx-auth.dclub.kr.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

# rate-limit zone 누락 시 경고
if ! grep -q "auth_login" /etc/nginx/nginx.conf 2>/dev/null; then
  echo "  ⚠ /etc/nginx/nginx.conf 의 http {} 안에 다음 추가 필요:"
  echo "      limit_req_zone \$binary_remote_addr zone=auth_login:10m rate=10r/s;"
  echo "      limit_req_zone \$binary_remote_addr zone=auth_api:10m rate=30r/s;"
fi

# 80 포트만 우선 (TLS 발급 전이라 443 cert 없음 → certbot이 만들어줌)
# 사용자가 certbot 명령 1줄 실행 후 nginx -t && reload

echo "[7/8] TLS 인증서 발급 (certbot)"
echo "  다음 명령 수동 실행:"
echo "    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@dclub.kr"
echo "    nginx -t && systemctl reload nginx"

# ── 8. 검증 안내 ────────────────────────────────────
echo "[8/8] 설치 완료"
echo ""
echo "검증:"
echo "  systemctl status dclub-auth"
echo "  curl http://127.0.0.1:30100/health"
echo "  curl https://$DOMAIN/.well-known/openid-configuration   # certbot 후"
echo "  journalctl -u dclub-auth -f"
