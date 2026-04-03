# v9 DB 스키마 설계 (20개)

**핵심: 단어 찾기 (Full-Text Search)**

## 📚 스키마 목록

| # | 스키마 | 목적 | 검색 대상 |
|---|--------|------|---------|
| 01 | users | 사용자 정보 | bio, full_name |
| 02 | posts | 게시물 | title, content, tags |
| 03 | comments | 댓글 | content |
| 04 | tags | 태그 | tag_name, description |
| 05 | categories | 카테고리 | category_name |
| 06 | products | 상품 | product_name, description |
| 07 | orders | 주문 | order_number, shipping_address |
| 08 | order_items | 주문 항목 | - |
| 09 | inventory | 재고 | - |
| 10 | reviews | 리뷰 | title, content |
| 11 | favorites | 찜 목록 | - |
| 12 | followers | 팔로우 | - |
| 13 | messages | 메시지 | subject, content |
| 14 | notifications | 알림 | message |
| 15 | sessions | 세션 | token |
| 16 | logs | 시스템 로그 | message, stack_trace |
| 17 | search_index | **단어 검색** ⭐ | word |
| 18 | full_text_search_cache | 검색 캐시 | query |
| 19 | hashtags | 해시태그 | tag |
| 20 | audit_log | 감사 로그 | resource_type, change_reason |

## 🔍 단어 찾기 (Full-Text Search) 아키텍처

### 핵심 구조

```
사용자 입력: "머신러닝 파이썬"
    ↓
토큰화 (Tokenize)
    └─ ["머신러닝", "파이썬"]
    ↓
검색 인덱스 조회 (search_index)
    ├─ word='머신러닝' → docs: [1, 5, 12] (POST/PRODUCT/COMMENT)
    └─ word='파이썬' → docs: [1, 8]
    ↓
결과 병합 (AND/OR/NOT)
    └─ 교집합: [1]
    ↓
정렬 (가중치 기반)
    └─ POST#1 (weight=0.95)
    ↓
캐시 저장
    └─ full_text_search_cache
    ↓
최종 결과
```

### 검색 대상 스키마

#### 17. search_index ⭐ (역인덱스)
- **word**: 검색 단어
- **document_type**: POST/PRODUCT/COMMENT/...
- **document_id**: 문서 ID
- **weight**: 가중치 (제목>내용>태그)
- **frequency**: 단어 빈도

**인덱스 전략:**
```
word="머신러닝" → [
  {doc_type: POST, doc_id: 1, weight: 1.0},
  {doc_type: PRODUCT, doc_id: 5, weight: 0.8},
]
```

#### 18. full_text_search_cache (성능 최적화)
- 자주 검색되는 쿼리 결과 캐시
- TTL: 1시간
- 10배 성능 개선

### 검색 플로우 상세

```
1️⃣  쿼리 분석
    Input: "Python 웹 개발"
    Tokens: [python, web, development]

2️⃣  캐시 확인
    query_hash = MD5("Python 웹 개발")
    캐시 HIT? → 즉시 반환 (5ms)
    캐시 MISS? → 계속 진행

3️⃣  인덱스 검색
    SELECT document_id FROM search_index
    WHERE word IN ['python', 'web', 'development']

4️⃣  결과 병합
    python AND web AND development
    → 교집합 계산

5️⃣  점수 계산
    weight: title(1.0) + content(0.5) + tags(0.3)
    final_score = SUM(weight * frequency)

6️⃣  정렬
    ORDER BY final_score DESC, created_at DESC

7️⃣  캐시 저장
    INSERT INTO full_text_search_cache
    (query_hash, result_ids, expires_at)

8️⃣  결과 반환
    [POST#1, PRODUCT#5, COMMENT#12]
```

## 🗂️ 스키마 분류

### 사용자 관련 (3개)
- users, followers, sessions

### 콘텐츠 (5개)
- posts, comments, tags, categories, reviews

### 상품/주문 (5개)
- products, orders, order_items, inventory, favorites

### 통신 (3개)
- messages, notifications, hashtags

### 시스템 (4개)
- logs, search_index, full_text_search_cache, audit_log

## 🚀 성능 특징

### 샤딩 전략

| 스키마 | 샤딩 키 | 분산 방식 |
|--------|---------|---------|
| users | user_id | Range |
| posts | user_id | Range |
| products | category_id | Range |
| orders | user_id | Range |
| **search_index** | **word** | **Hash** |
| tags | tag_name | Hash |
| hashtags | tag | Hash |

### 복제 설정

| 중요도 | 복제 방식 | 계수 | 스키마 |
|--------|---------|------|--------|
| 🔴 높음 | Synchronous | 3 | users, orders, audit_log |
| 🟡 중간 | Synchronous | 3 | products, messages |
| 🟢 낮음 | Asynchronous | 2 | posts, comments, logs |

## 📊 쿼리 성능 예상

### 단일 단어 검색
```sql
SELECT document_id FROM search_index WHERE word = '머신러닝'
-- 예상 시간: 5ms (인덱스 조회)
-- 샤드: word_hash % 4 → 단일 샤드 접근
```

### 다중 단어 검색 (AND)
```sql
SELECT si1.document_id FROM search_index si1
JOIN search_index si2 ON si1.document_id = si2.document_id
WHERE si1.word = 'python' AND si2.word = 'web'
-- 예상 시간: 15ms (2개 샤드 + 병합)
```

### 자동완성
```sql
SELECT DISTINCT word FROM search_index WHERE word LIKE 'pyt%'
-- 예상 시간: 8ms (prefix scan)
```

### 캐시 히트
```
-- 캐시 없음: 50ms (full-text 검색)
-- 캐시 있음: 5ms (캐시 조회)
-- 개선도: 10배 ⬆️
```

## 🔐 규정 준수

### 개인정보 보호
- GDPR: audit_log에 모든 변경 기록
- 삭제 권리: soft_delete 패턴 사용
- 암호화: password_hash (해시)

### 감사 추적
- audit_log: 모든 CRUD 작업 기록
- Immutable: 감사 로그는 수정 불가
- 보관 기간: 7년+

## 🎯 사용 사례

### 1. 사용자 검색
```
Input: "개발자 인천"
Search: users.bio, users.full_name
```

### 2. 게시물 검색
```
Input: "React 성능 최적화"
Search: posts.title, posts.content, posts.tags
→ search_index에서 역인덱스 조회
```

### 3. 상품 검색
```
Input: "SSD 1TB 노트북"
Search: products.product_name, products.description
+필터: category_id, price
```

### 4. 주문 추적
```
Input: "주문번호 12345"
Search: orders.order_number
→ shipping_address로도 검색 가능
```

### 5. 에러 로그 검색
```
Input: "NullPointerException"
Search: logs.message, logs.stack_trace
```

## 📈 확장성

### 현재 용량
- 총 레코드: ~1억 개
- 저장 공간: 500GB
- 검색 인덱스: 100GB

### 확장 전략
1. **샤드 추가**: word 기준 샤드 분할
2. **노드 추가**: 각 샤드를 여러 노드에 복제
3. **캐시 확대**: Redis 캐시 추가

## 📝 다음 단계

1. ✅ 스키마 설계 (20개)
2. ⏳ 인덱스 최적화
3. ⏳ 검색 엔진 구현
4. ⏳ 성능 벤치마킹
5. ⏳ 프로덕션 배포
