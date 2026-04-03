# v9 DB 표준 라이브러리 마이그레이션 계획

## 목표
기존 v9 DB 코드를 새 표준 라이브러리 사용으로 재구현
- **코드 감소**: 8,953줄 → 6,500줄 (25% 감소)
- **성능 개선**: 15% 향상
- **유지보수**: 복잡도 감소

## 마이그레이션 항목

### 1. v9-db-core.fl
**현재**: 418줄
**변경사항**:
- `timestamp` 하드코드 제거 → `stdlib::time` 사용
- 에러 처리 개선 → `stdlib::result` (Result<T>)
- 예상 코드: 350줄 (16% 감소)

### 2. v9-db-sql.fl
**현재**: 575줄
**변경사항**:
- `sql_tokenize()` → `stdlib::string::string_split()` 사용
- SQL 주입 감지 → `stdlib::regex` 사용
- 예상 코드: 420줄 (27% 감소)

### 3. v9-db-index-optimized.fl
**현재**: 268줄
**변경사항**:
- 로깅 → `stdlib::logging` 사용
- 메트릭 → `stdlib::memory` 추적
- 예상 코드: 240줄 (10% 감소)

### 4. 로깅 통일
**before**:
```freelang
println("[LOCK-ACQUIRE] tx_id ...")
println("[ERROR] message")
```

**after**:
```freelang
var logger = logger_new("v9-db")
log_info(logger, "Lock acquired")
log_error(logger, "Error occurred")
```

### 5. 에러 처리 통일
**before**:
```freelang
var err = validate_input()
if err.error_code != 0 { return err }
```

**after**:
```freelang
var result = validate_input()
if is_err(result) { return result }
var value = unwrap(result)
```

### 6. JSON 직렬화
**before**:
```freelang
var json = "{\"field\":\"" + value + "\"}"
```

**after**:
```freelang
var fields = ["\"field\":\"" + value + "\""]
var json_obj = json_object(fields)
var json = json_stringify(json_obj)
```

## 마이그레이션 순서

1. **Phase 1**: 기본 라이브러리 (time, io, string)
   - 3일 예상

2. **Phase 2**: 고급 라이브러리 (json, logging, result)
   - 3일 예상

3. **Phase 3**: v9-db 코어 재작성
   - 5일 예상

4. **Phase 4**: 전체 통합 및 테스트
   - 2일 예상

5. **Phase 5**: 성능 최적화
   - 2일 예상

**총 소요 시간**: 2주

## 검증 기준

- ✅ 모든 기존 테스트 통과
- ✅ 코드 라인 수 25% 감소
- ✅ 성능 15% 향상
- ✅ 새 표준 라이브러리 100% 사용

## 기대 효과

| 메트릭 | 현재 | 이후 | 개선 |
|--------|------|------|------|
| 코드 라인 | 8,953 | 6,500 | 27% ⬇️ |
| 순환도 | 높음 | 중간 | 40% ⬇️ |
| 유지보수성 | 낮음 | 높음 | 50% ⬆️ |
| 성능 | 기준 | +15% | 15% ⬆️ |

## 마이그레이션 후 아키텍처

```
Application
    ↓
API Layer (v9-db-sql.fl) - 100줄 감소
    ↓
Engine Layer (v9-db-engine.fl) - 50줄 감소
    ↓
Storage Layer (v9-db-storage.fl) - 20줄 감소
    ↓
Standard Library
  ├── time, io, string, json
  ├── regex, logging, result
  ├── collections, memory
  └── datetime, arrays
```

## 다음 단계

1. 각 v9-db 모듈 단위별 마이그레이션
2. 통합 테스트 실행
3. 성능 벤치마크
4. 최종 검증
