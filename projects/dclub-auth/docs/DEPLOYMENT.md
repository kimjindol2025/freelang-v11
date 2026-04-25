# dclub-auth 운영 배포

## 목적
`auth.dclub.kr` 도메인에 dclub-auth IdP 를 운영 등급으로 배포.
nginx TLS + systemd 자동 재시작 + 보안 sandbox.

## 시스템 요구사항
- Ubuntu 22.04+ / Debian 12+, Node.js 18+, nginx 1.18+, certbot
- DNS: `auth.dclub.kr` → 서버 IP
- 방화벽: 80, 443 INBOUND 허용

## 1. 코드 배포
```bash
sudo mkdir -p /opt/dclub-auth && cd /opt/dclub-auth
sudo git clone https://gogs.dclub.kr/kim/freelang-v11.git .
sudo git checkout feature/dclub-auth
sudo npm install && sudo npm run build
```

## 2. 1-shot 설치
```bash
sudo bash /opt/dclub-auth/projects/dclub-auth/deploy/install.sh
```
스크립트가 사용자·디렉터리·systemd·nginx site 일괄 처리.

## 3. TLS 발급
```bash
sudo certbot --nginx -d auth.dclub.kr --non-interactive --agree-tos -m admin@dclub.kr
sudo nginx -t && sudo systemctl reload nginx
```

## 4. rate-limit zone (`/etc/nginx/nginx.conf` http {} 안)
```nginx
limit_req_zone $binary_remote_addr zone=auth_login:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth_api:10m rate=30r/s;
```

## 5. 검증
```bash
curl http://127.0.0.1:30100/health                                # 백엔드 직접
curl https://auth.dclub.kr/health                                 # TLS
curl https://auth.dclub.kr/.well-known/openid-configuration       # OIDC
curl https://auth.dclub.kr/jwks.json                              # 공개키
curl https://auth.dclub.kr/sdk/dclub-auth-client.js | head        # SDK
```

기대: `/health` → `{"status":"ok",...}`, 나머지 200.

## 운영 명령
```bash
systemctl status dclub-auth                # 상태
journalctl -u dclub-auth -f                # 로그 실시간
tail -f /var/log/dclub-auth/server.log     # 파일 로그
sudo systemctl restart dclub-auth          # 재시작

# DB 백업 (cron 권장)
sudo -u dclub-auth sqlite3 /var/lib/dclub-auth/auth.db ".backup /var/lib/dclub-auth/auth.db.$(date +%F)"
```

## 보안 체크리스트
- [ ] `/etc/dclub-auth/env` 권한 `600`, owner `dclub-auth`
- [ ] DB 파일 권한 `600`, owner `dclub-auth`
- [ ] HTTPS 강제 + HSTS 1년 (✓ nginx 설정 포함)
- [ ] systemd sandbox (ProtectSystem=strict 등 ✓ unit에 포함)
- [ ] DB 일별 백업 cron
- [ ] 로그 회전 — `/etc/logrotate.d/dclub-auth`
- [ ] 키 회전 daily cron — `jwks-cron-tick` 호출
- [ ] 모니터링 — `/health` 1분 체크 (uptime-kuma 등)

## 로그 회전 (`/etc/logrotate.d/dclub-auth`)
```
/var/log/dclub-auth/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 dclub-auth dclub-auth
}
```

## 첫 클라이언트 등록 (예: blog.dclub.kr)
```bash
sudo -u dclub-auth sqlite3 /var/lib/dclub-auth/auth.db <<EOF
INSERT INTO clients (client_id, client_secret, name, redirect_uris,
                     allowed_scopes, is_public, require_consent, created_at)
VALUES ('blog', '$(openssl rand -hex 32)', 'blog.dclub.kr',
        'https://blog.dclub.kr/oauth/callback',
        'openid profile email', 0, 0, datetime('now'));
EOF
```

## 트러블슈팅
| 증상 | 해결 |
|---|---|
| systemd 시작 실패 | `journalctl -u dclub-auth -n 50` 확인 |
| /health 503 | DB 권한 또는 키 생성 실패 |
| 502 Bad Gateway | `systemctl status dclub-auth` (백엔드 다운) |
| TLS 갱신 실패 | `certbot renew --dry-run` (80 포트 확인) |
| SDK CORS 에러 | nginx `Access-Control-Allow-Origin` 확인 |

## 업그레이드
```bash
cd /opt/dclub-auth && sudo git pull origin feature/dclub-auth
sudo npm install && sudo npm run build
sudo systemctl restart dclub-auth
curl http://127.0.0.1:30100/health
```

## 롤백
```bash
cd /opt/dclub-auth
sudo git log --oneline | head -10        # 안정 SHA 선택
sudo git checkout <SHA>
sudo npm run build && sudo systemctl restart dclub-auth
```

---
**저장소**: https://gogs.dclub.kr/kim/freelang-v11 (`feature/dclub-auth`)
