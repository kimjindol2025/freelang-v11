# FreeLang v9 예제

FreeLang v9로 만드는 다양한 애플리케이션 예제들입니다.

## 기초

### [TODO 앱](./todo-app.md)
간단한 할일 관리 웹 애플리케이션 (CREATE, READ, UPDATE, DELETE)

---

## 데이터 분석

### 판매 분석
```lisp
(import v9-data)

(let [sales (table/load-csv "sales.csv")]
  (-> sales
      (table/filter (fn [row] (> (:amount row) 1000)))
      (table/group-by :region)
      (table/aggregate :amount :sum)
      (plot/bar-chart)))
```

### 통계 리포트
```lisp
(let [data [10 20 30 40 50]]
  {:mean (stats/mean data)
   :median (stats/median data)
   :stddev (stats/stddev data)})
```

---

## AI 블록 활용

### 자동 분류
```lisp
[TOT
 :problem "이메일 분류"
 :branches [
  "스팸 필터"
  "중요도 분석"
  "주제별 분류"
 ]
 :select :best]
```

### 추론 기반 추천
```lisp
[HYPOTHESIS
 :claim "사용자는 비슷한 상품을 구매할 가능성이 높다"
 :test (recommend-similar-products user-id)]
```

---

## 마이크로서비스

### 주문 처리 시스템
```lisp
[SERVICE order-service :port 8001
 :routes [...]]

[SERVICE payment-service :port 8002
 :routes [...]]

(queue/publish "events" "order.created" {...})
```

---

## 다음 단계

- [언어 기초](../guide/basics.md) 배우기
- [API 레퍼런스](../api/stdlib.md) 보기
- [GitHub 저장소](https://github.com/kimjindol2025/freelang-v9)에서 더 많은 예제 찾기
