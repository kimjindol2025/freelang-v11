# freelang-search

> 자체 stack 전체 통합 검색 — 한 쿼리로 blog·gogs·memory·audit·storage 동시 검색

## 정체

**자체 stack에 누적된 모든 데이터에 통합 full-text 검색**.
- blog.dclub.kr 540+ posts
- gogs.dclub.kr 598 저장소 코드
- /root/.claude/projects/-root/memory/*.md (메모리 시스템)
- dclub-auth audit_log (감사 이벤트)
- dclub-storage 객체 metadata
- guestbook 1,618 메시지 (AI 인스턴스 보고)
- freelang-gpt corpus (학습 데이터)

→ 1년 누적 자산을 _찾기_가 매일 5분 절약. 자체 LLM(freelang-gpt)의
   사전 처리기로도 결합 가능 (Claude 호출 컨텍스트 압축).

## 자주권 원칙

- 외부 npm 0개
- TS 추가 0줄 (SQLite FTS5 빌트인 + 기존 db_query 활용)
- 100% FreeLang 도메인 로직
- 외부 검색 엔진 (Google CSE·Algolia·Elasticsearch) 의존 0

## pkg-fl 과의 차별점

| | pkg-fl | freelang-search |
|---|---|---|
| 범위 | 메모·노트 단일 도메인 | **자체 stack 전체 도메인** |
| 인덱싱 출처 | JSON 메모 | blog·gogs·memory·audit·storage·guestbook 다중 |
| 사용 | 개인 지식 베이스 | **운영자 + AI 사전 처리기** |
| 위치 | `/root/kim/pkg-fl` (별도) | freelang-v11/projects/ (PaaS layer) |

## 아키텍처

```
[blog.dclub.kr] ─┐
[gogs ↓ files] ──┤
[memory/*.md] ───┼─→ indexer → SQLite FTS5 → searcher → HTTP API
[audit_log] ─────┤                ↑                       ↓
[guestbook] ─────┘          BM25 ranking            ?q=... 결과
[gpt corpus] ────┘
```

## 핵심 기술 결정

- **SQLite FTS5** (Virtual Table + BM25) — 외부 의존 0, 표준 기능
- **단일 docs_fts 테이블** — source 컬럼으로 도메인 구분
- **docs_meta** — url/indexed_at 등 메타 (FTS와 분리)
- **idempotent indexing** — DELETE + INSERT (재인덱싱 안전)
- **한국어** — `tokenize='unicode61'` 기본. 향후 nori/MeCab은 X.x

## API (1차 MVP)

```
GET  /search?q=...&limit=20&source=blog       → 통합 또는 source 한정 검색
POST /index                                    → 단일 doc 인덱싱
GET  /stats                                    → 인덱스 상태 (총 N + 소스별)
GET  /health                                   → 서비스 상태
```

응답 형식:
```json
{
  "query": "freelang",
  "hits": 42,
  "results": [
    {
      "doc_id": "blog-540",
      "source": "blog",
      "title": "워크스페이스 정밀 진단",
      "excerpt": "FreeLang v11 <b>생태계</b> 관계도 + 190MB 정리...",
      "url": "https://blog.dclub.kr/#540",
      "score": -8.42
    }
  ]
}
```

## 로드맵 (95% 도달, 2026-04-26)

| Phase | 상태 | 내용 |
|---|---|---|
| S0 | ✅ | 구조·README·기본 모듈 (config·index-store·searcher·server) |
| S1 | ✅ | 5 connectors (blog·guestbook·audit·memory·gogs) + indexer |
| S2 | ✅ | cron 자동 재인덱싱 (`set_interval`, FREELANG_SEARCH_CRON_MS env) |
| S3 | 🟡 | 한국어 — unicode61 기본 충분 확인. nori 정밀화는 옵션 |
| S4 | ✅ | `GET /context?q=...` LLM 사전 처리기 (Claude 토큰 절감) |
| S1.2.1 | 🔄 | memory 개별 파일 인덱싱 (file_list stdlib 추가 후) |
| S1.3 | 🔄 | freelang-gpt corpus connector (대용량) |
| S5 | 🔄 | 검색 추천 (related queries, did you mean) |

## 검증 도메인 (FL이 검색 엔진 짤 수 있나?)

- ✅ FTS5 Virtual Table 생성·관리
- ✅ MATCH 쿼리 + BM25 정렬
- ✅ snippet() 결과 하이라이트
- ⏳ 인덱싱 connector 다양성 (S1)
- ⏳ 한국어 토크나이저 정확도 (S3)

→ 이 트랙도 _구글 복제_가 아니라 **FL이 검색 엔진 도메인 짤 수 있나 검증**의 데이터 공급원.
