# Schema: search_index

**목적:** 단어 기반 검색 인덱스 ⭐ (핵심)

## 컬럼 정의

| 컬럼 | 타입 | 설명 |
|------|------|------|
| index_id | INTEGER PRIMARY KEY | 인덱스 ID |
| word | STRING NOT NULL | 검색 단어 |
| document_type | STRING | 문서 타입 (POST/PRODUCT/COMMENT) |
| document_id | INTEGER | 문서 ID |
| frequency | INTEGER | 단어 빈도 |
| position | STRING | 단어 위치 (필드명) |
| weight | FLOAT | 가중치 (0.0-1.0) |
| created_at | INTEGER | 생성 시간 |

## 인덱스

- PRIMARY KEY: index_id
- UNIQUE: (word, document_type, document_id) ← 중요!
- INDEX: word (단어 검색)
- INDEX: document_id (문서별 역인덱스)
- INDEX: document_type

## 샤딩 전략

- **샤딩 키**: word (단어를 기준으로 분산)
- 같은 단어는 같은 샤드에 저장 → 효율적인 검색

## 복제 설정

- **복제 방식**: Synchronous
- **복제 계수**: 3

## 쿼리 예시

```sql
-- 단일 단어 검색
SELECT document_id, document_type FROM search_index 
WHERE word = '머신러닝' AND document_type = 'POST'
ORDER BY weight DESC;

-- 여러 단어 검색 (AND)
SELECT si1.document_id FROM search_index si1
JOIN search_index si2 ON si1.document_id = si2.document_id
WHERE si1.word = '파이썬' AND si2.word = '데이터'
AND si1.document_type = 'PRODUCT';

-- 자동완성
SELECT DISTINCT word FROM search_index 
WHERE word LIKE '머%' LIMIT 10;
```

## 특징

✅ **역인덱스** (Inverted Index)
- word → document_id 매핑
- 매우 빠른 검색 (O(log n))

✅ **가중치 기반 순위**
- 제목(1.0) > 내용(0.5) > 태그(0.3)

✅ **자동완성**
- LIKE '%prefix%'로 자동완성 지원

## 검색 플로우

```
사용자 입력: "머신러닝 가이드"
    ↓
Tokenize: ["머신러닝", "가이드"]
    ↓
Search Index 조회:
  - word='머신러닝' → document_ids: [1, 5, 12]
  - word='가이드' → document_ids: [1, 8]
    ↓
결과 병합 (AND): [1]
    ↓
정렬 (weight): document_1 (weight=0.9)
    ↓
최종 결과: POST#1
```
