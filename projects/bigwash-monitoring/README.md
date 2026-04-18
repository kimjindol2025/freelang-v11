# Bigwash Monitoring

**Ultra-light edge monitoring agent** for low-spec devices (Termux, Raspberry Pi, VPS).

- 🚀 **< 1MB binary** | Ultra-minimal footprint
- 👻 **Ghost Mode** | < 5MB RAM usage (목표)
- ⚡ **Real-time metrics** | CPU/RAM/Disk/Network
- 🔒 **Secure by default** | JWT + TLS encryption (Phase 2)
- 📊 **v9-First** | 100% FreeLang v9 implementation

## Quick Start

```bash
# Termux / Linux
cd projects/bigwash-monitoring
cp config.json config.local.json
node ../../bootstrap.js run main.fl --config ./config.local.json
```

## Progress

### ✅ Phase 1: Core Engine (완료)

| Stage | 상태 | 내용 |
|-------|------|------|
| **1a** | ✅ | 프로젝트 구조 + 설계 |
| **1b** | ✅ | 실제 RAM/Disk 수집 |
| **1c** | ✅ | CPU Load + Network 추가 |
| **1d** | ⏳ | Ring Buffer + 로컬 저장 |

### ⏳ Phase 2: Secure Connectivity (진행 중)

| Stage | 상태 | 내용 |
|-------|------|------|
| **2a** | ⏳ | HTTP 클라이언트 (stdlib-http) |
| **2b** | ⏳ | JSON 직렬화 |
| **2c** | ⏳ | JWT 토큰 생성 |
| **2d** | ⏳ | 배치 전송 + 재시도 |

### 🟡 Phase 3: Control Plane (예정)

- 중앙 서버 (v9 FLNext)
- REST API (30 엔드포인트)
- 웹 대시보드

### 🟡 Phase 4: Market Entry (예정)

- MVP 출시 (폐쇄 베타)
- 과금 시스템

## Performance

| 지표 | 현재 | 목표 |
|------|------|------|
| 실행시간 | 312ms | < 100ms |
| 메모리 | 303MB | < 10MB |
| CPU | 4.80 load | < 2% |

## Architecture

```
┌──────────────────┐
│  Agent (v9)      │  Phase 1: ✅
│  - 메트릭 수집   │
│  - JSON 직렬화   │
└────────┬─────────┘
         │ (Phase 2)
         │ HTTP POST
         │ JWT Token
         │
┌────────▼─────────┐
│  Gateway         │  Phase 2: ⏳
│  - TLS 암호화    │
│  - 배치 전송     │
│  - 재시도 로직   │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  Server (v9)     │  Phase 3: 🟡
│  - REST API      │
│  - 데이터 저장   │
│  - 대시보드      │
└──────────────────┘
```

## Technology Stack

- **Language**: v9 (100%)
- **HTTP Client**: stdlib-http
- **Auth**: JWT + SHA-256
- **Serialization**: JSON Lines
- **Protocol**: HTTPS
- **Dependencies**: 0 (Zero)

## Configuration

```json
{
  "server": {
    "url": "https://bigwash.example.com",
    "port": 443
  },
  "auth": {
    "node_id": "node-termux-001",
    "api_key": "sk_test_abc123xyz"
  },
  "transport": {
    "batch_size": 100,
    "batch_interval_ms": 5000
  }
}
```

## Gogs Repository

https://gogs.dclub.kr/kim/freelang-v9.git (projects/bigwash-monitoring/)

| Phase | Commit | 상태 |
|-------|--------|------|
| 1a | 3d29a86 | ✅ |
| 1b | e1994d9 | ✅ |
| 1c | 6236f29 | ✅ |
| 1d | ⏳ | ⏳ |
| 2a | ⏳ | ⏳ |

## Next Steps

### 이번 주 (Phase 1d)
- [ ] Ring Buffer 구현 (메모리 효율성)
- [ ] JSON Lines 파일 저장
- [ ] 주기적 flush

### 다음 주 (Phase 2a)
- [ ] HTTP 클라이언트 구현
- [ ] JWT 토큰 생성
- [ ] 배치 전송

### 2주 후 (Phase 2b-d)
- [ ] 재시도 로직
- [ ] 에러 처리
- [ ] 모니터링

## Design Document

전체 설계: `BIGWASH-MONITORING-DESIGN.md`

---

**상태**: Phase 1 완료 ✅ | Phase 2 진행 중 ⏳
**Execution Time**: 312ms
**Memory**: 303MB (bootstrap 포함)
**v9 Pure**: 100% | Dependencies: 0
