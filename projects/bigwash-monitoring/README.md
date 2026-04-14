# Bigwash Monitoring

**Ultra-light edge monitoring agent** for low-spec devices (Termux, Raspberry Pi, VPS).

- 🚀 **< 1MB binary** | Ultra-minimal footprint
- 👻 **Ghost Mode** | < 5MB RAM usage
- ⚡ **30 second install** | Single command setup
- 🔒 **Secure by default** | JWT + TLS encryption
- 📊 **Real-time metrics** | CPU/RAM/Disk/Network
- 🎯 **v9-First** | 100% FreeLang v9 implementation

## Quick Start (Termux)

```bash
# 1. 설정 파일 복사
cp config.json config.local.json

# 2. 에이전트 실행
v9 main.fl --config ./config.local.json

# 3. 디버그 모드 (로컬 파일 저장)
v9 main.fl --config ./config.local.json --debug-file metrics.jsonl
```

## Phase 1: Core Engine (현재)

- [x] 프로젝트 구조 설계
- [x] main.fl (진입점)
- [x] config.json (설정 예시)
- [ ] src/collector.fl (지표 수집)
- [ ] src/buffer.fl (Ring Buffer)
- [ ] test/ (단위 테스트)

## Architecture

```
┌──────────────────┐
│  Agent (v9)      │
│  - CPU/RAM수집   │
│  - 로컬 버퍼링   │
└────────┬─────────┘
         │ (Phase 2)
         ▼
┌──────────────────┐
│  Gateway         │
│  - 암호화/전송   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Server (v9)     │
│  - 데이터 저장   │
│  - 대시보드      │
└──────────────────┘
```

## Configuration

```json
{
  "collection": {
    "interval_ms": 5000,     // 수집 주기
    "buffer_size": 1000,     // 로컬 버퍼 크기
    "metrics": [...]         // 수집할 지표
  }
}
```

## Performance Target

| Metric | Target | Status |
|--------|--------|--------|
| **Memory** | < 10MB | Phase 1 |
| **CPU** | < 2% | Phase 1 |
| **Network** | < 100 Kbps | Phase 2 |
| **Collection Rate** | 100% | Phase 1 |

## Roadmap

### Phase 1: Core Engine (2 weeks)
- Core metrics collection
- Local buffering
- Performance validation

### Phase 2: Secure Connectivity (1.5 weeks)
- v9-tunnel integration
- Protobuf serialization
- JWT authentication

### Phase 3: Control Plane (2 weeks)
- Central server (v9 FLNext)
- Web dashboard
- Alert engine

### Phase 4: Market Entry (3 weeks)
- MVP launch
- Pricing tiers
- B2B partnerships

## Development

```bash
# 테스트 실행
v9 test test/*.test.fl --parallel --workers 4

# 빌드
v9-build main.fl --output dist/agent.js

# 성능 검증
time v9 main.fl --config ./config.json --debug-file /dev/null
```

## License

MIT © Bigwash Team 2026

## Design Document

전체 설계는 [`BIGWASH-MONITORING-DESIGN.md`](/data/data/com.termux/files/home/BIGWASH-MONITORING-DESIGN.md) 참조.
