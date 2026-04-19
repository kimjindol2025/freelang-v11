# 스타일 시스템 가이드

> STYLE + THEME 블록으로 CSS를 FreeLang에서 선언형으로 정의하기

---

## 📚 개요

FreeLang v11은 **THEME** (디자인 토큰) 과 **STYLE** (컴포넌트 스타일) 블록으로 CSS를 선언형으로 정의합니다.

```lisp
;; 디자인 토큰 정의 (THEME)
(theme default
  :tokens {:primary "#2563eb" :space-md "16px"})

;; 컴포넌트 스타일 (STYLE)
(style btn-primary
  :selector ".btn-primary"
  :rules {:bg "var(--primary)" :padding "var(--space-md)"})
```

생성 결과:
```css
:root {
  --primary: #2563eb;
  --space-md: 16px;
}

.btn-primary {
  background: var(--primary);
  padding: var(--space-md);
}
```

---

## 🎨 THEME 블록 (디자인 토큰)

### 문법

```lisp
(theme [name]
  :tokens {
    :token-name "value"
    :color-primary "#2563eb"
    :font-size-sm "12px"
    ...
  })
```

### 파라미터

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `name` | 테마 이름 (생략 가능) | `"default"` |
| `:tokens` | 디자인 토큰 맵 | 필수 |

### 예제 1: 기본 테마

```lisp
(theme default
  :tokens {
    ;; 색상
    :primary "#2563eb"
    :secondary "#64748b"
    :success "#10b981"
    :warning "#f59e0b"
    :error "#ef4444"
    :text "#111827"
    :text-light "#6b7280"
    :bg "#ffffff"
    :bg-light "#f9fafb"
    
    ;; 공간
    :space-xs "4px"
    :space-sm "8px"
    :space-md "16px"
    :space-lg "24px"
    :space-xl "32px"
    
    ;; 반경
    :radius-sm "4px"
    :radius-md "8px"
    :radius-lg "12px"
    
    ;; 글꼴
    :font-size-xs "12px"
    :font-size-sm "14px"
    :font-size-md "16px"
    :font-size-lg "18px"
    :font-weight-normal "400"
    :font-weight-bold "700"
  })

(println "✅ 13개 토큰 정의됨")
```

### 예제 2: 다크 테마

```lisp
(theme dark
  :tokens {
    :primary "#3b82f6"
    :text "#f3f4f6"
    :bg "#111827"
    :bg-light "#1f2937"
    :border "#374151"
  })

(println "✅ 다크 테마 정의됨")
```

### CSS 변수 참조

THEME에서 정의한 토큰은 CSS 변수(`--token-name`)로 자동 변환됩니다.

```lisp
(theme default :tokens {:primary "#2563eb"})

;; 생성 CSS:
;; :root { --primary: #2563eb; }

;; STYLE에서 사용:
(style btn :selector ".btn" :rules {:bg "var(--primary)"})
```

---

## 🎯 STYLE 블록 (컴포넌트 스타일)

### 문법

```lisp
(style [name]
  :selector "css-selector"
  :rules {
    :property "value"
    :color "#000"
    ...
  })
```

### 파라미터

| 파라미터 | 설명 | 기본값 |
|---------|------|--------|
| `name` | 스타일 이름 (생략 가능) | `"default"` |
| `:selector` | CSS 선택자 | 필수 |
| `:rules` | CSS 속성 맵 | 필수 |

### 예제 1: 버튼 스타일

```lisp
;; 기본 버튼
(style btn
  :selector ".btn"
  :rules {
    :display "inline-block"
    :p "var(--space-md)"
    :border "none"
    :r "var(--radius-md)"
    :cursor "pointer"
    :fw "500"
    :transition "all 0.2s"
  })

;; 기본 버튼 (파란색)
(style btn-primary
  :selector ".btn-primary"
  :rules {
    :bg "var(--primary)"
    :color "white"
  })

;; 보조 버튼 (회색)
(style btn-secondary
  :selector ".btn-secondary"
  :rules {
    :bg "var(--secondary)"
    :color "white"
  })

;; 버튼 호버 상태
(style btn-hover
  :selector ".btn:hover"
  :rules {
    :opacity "0.9"
    :transform "translateY(-2px)"
  })
```

### 예제 2: 카드 컴포넌트

```lisp
;; 카드 기본
(style card
  :selector ".card"
  :rules {
    :bg "var(--bg)"
    :border "1px solid var(--border)"
    :r "var(--radius-lg)"
    :p "var(--space-lg)"
    :box-shadow "0 1px 3px rgba(0,0,0,0.1)"
  })

;; 카드 제목
(style card-title
  :selector ".card-title"
  :rules {
    :fs "20px"
    :fw "bold"
    :color "var(--text)"
    :margin-bottom "var(--space-md)"
  })

;; 카드 본문
(style card-body
  :selector ".card-body"
  :rules {
    :color "var(--text-light)"
    :line-height "1.6"
  })
```

### 예제 3: 레이아웃

```lisp
;; 컨테이너
(style container
  :selector ".container"
  :rules {
    :max-width "1200px"
    :m "0 auto"
    :p "var(--space-lg)"
  })

;; 플렉스 레이아웃
(style flex-row
  :selector ".flex-row"
  :rules {
    :display "flex"
    :flex-direction "row"
    :gap "var(--space-md)"
    :align-items "center"
  })

;; 그리드 레이아웃
(style grid
  :selector ".grid"
  :rules {
    :display "grid"
    :grid-template-columns "repeat(3, 1fr)"
    :gap "var(--space-md)"
  })

;; 그리드 반응형
(style grid-responsive
  :selector ".grid-responsive"
  :rules {
    :display "grid"
    :grid-template-columns "repeat(auto-fit, minmax(300px, 1fr))"
    :gap "var(--space-md)"
  })
```

---

## 📝 CSS 속성 단축 키워드

FreeLang은 일반적인 CSS 속성을 단축 키워드로 지원합니다.

| 단축 | 전체 이름 | 예제 |
|------|----------|------|
| `:bg` | `background` | `:bg "blue"` |
| `:fg` | `color` | `:fg "white"` |
| `:p` | `padding` | `:p "16px"` |
| `:m` | `margin` | `:m "0"` |
| `:w` | `width` | `:w "100%"` |
| `:h` | `height` | `:h "auto"` |
| `:r` | `border-radius` | `:r "8px"` |
| `:b` | `border` | `:b "1px solid #ccc"` |
| `:fs` | `font-size` | `:fs "14px"` |
| `:fw` | `font-weight` | `:fw "bold"` |
| `:d` | `display` | `:d "flex"` |
| `:o` | `opacity` | `:o "0.5"` |
| `:z` | `z-index` | `:z "10"` |

### 전체 CSS 속성명도 사용 가능

```lisp
(style card
  :selector ".card"
  :rules {
    ;; 단축 사용
    :p "16px"
    :r "8px"
    
    ;; 전체 이름도 가능
    :border "1px solid #ccc"
    :box-shadow "0 1px 3px rgba(0,0,0,0.1)"
    :border-radius "8px"
  })
```

---

## 🔗 CSS 변수 활용

### 토큰 참조

```lisp
(theme default
  :tokens {
    :primary "#2563eb"
    :space-md "16px"
    :radius-md "8px"
  })

(style btn
  :selector ".btn"
  :rules {
    :bg "var(--primary)"
    :p "var(--space-md)"
    :r "var(--radius-md)"
  })

;; 생성 CSS:
;; :root { --primary: #2563eb; --space-md: 16px; --radius-md: 8px; }
;; .btn { background: var(--primary); padding: var(--space-md); border-radius: var(--radius-md); }
```

### 동적 토큰

```lisp
(define colors {:primary "#2563eb" :secondary "#64748b"})

(theme default :tokens colors)

;; 또는 런타임에 토큰 생성
(let [color-map {
  :primary "#2563eb"
  :secondary "#64748b"
  :success "#10b981"
}]
  (theme dynamic :tokens color-map))
```

---

## 🎯 실전 예제

### 완전한 디자인 시스템

```lisp
;; 1. 테마 정의
(theme default
  :tokens {
    ;; 색상 팔레트
    :primary "#2563eb"
    :secondary "#64748b"
    :success "#10b981"
    :error "#ef4444"
    :text "#111827"
    :text-light "#6b7280"
    :bg "#ffffff"
    :bg-light "#f9fafb"
    :border "#e5e7eb"
    
    ;; 공간 스케일
    :space-xs "4px"
    :space-sm "8px"
    :space-md "16px"
    :space-lg "24px"
    
    ;; 타이포그래피
    :font-size-sm "14px"
    :font-size-md "16px"
    :font-size-lg "18px"
    :font-weight-normal "400"
    :font-weight-bold "700"
    
    ;; 반경
    :radius-sm "4px"
    :radius-md "8px"
    :radius-lg "12px"
  })

;; 2. 기본 컴포넌트
(style btn-base
  :selector ".btn"
  :rules {
    :display "inline-block"
    :p "var(--space-md)"
    :border "none"
    :r "var(--radius-md)"
    :cursor "pointer"
    :fw "var(--font-weight-bold)"
    :transition "all 0.2s"
  })

(style btn-primary
  :selector ".btn-primary"
  :rules {
    :bg "var(--primary)"
    :color "white"
  })

(style btn-primary-hover
  :selector ".btn-primary:hover"
  :rules {
    :bg "#1d4ed8"
    :box-shadow "0 4px 6px rgba(37, 99, 235, 0.2)"
  })

;; 3. 카드 컴포넌트
(style card
  :selector ".card"
  :rules {
    :bg "var(--bg)"
    :border "1px solid var(--border)"
    :r "var(--radius-lg)"
    :p "var(--space-lg)"
    :box-shadow "0 1px 2px rgba(0,0,0,0.05)"
  })

;; 4. 레이아웃
(style container
  :selector ".container"
  :rules {
    :max-width "1200px"
    :m "0 auto"
    :p "var(--space-lg)"
  })

(style grid
  :selector ".grid"
  :rules {
    :display "grid"
    :grid-template-columns "repeat(auto-fit, minmax(300px, 1fr))"
    :gap "var(--space-md)"
  })

(println "✅ 완전한 디자인 시스템 정의됨")
```

### HTML에서 사용

```html
<div class="container">
  <div class="grid">
    <div class="card">
      <h2 class="card-title">카드 제목</h2>
      <p class="card-body">카드 본문 내용</p>
      <button class="btn btn-primary">클릭하기</button>
    </div>
  </div>
</div>
```

---

## 🔄 렌더링 흐름

```
FL 코드 평가
  ↓
(theme ...) 블록 → :root { --token: value; } 생성
  ↓
(style ...) 블록 → .selector { prop: value; } 생성
  ↓
styleRegistry에 수집
  ↓
페이지 렌더링
  ↓
<style> 태그로 자동 주입
```

---

## ✅ 모범 사례

### ✓ 좋은 예

```lisp
;; 1. 토큰 먼저, 스타일은 토큰 참조
(theme default :tokens {:primary "#2563eb" :space-md "16px"})
(style btn :selector ".btn" :rules {:bg "var(--primary)" :p "var(--space-md)"})

;; 2. 의미 있는 이름 사용
(style btn-primary :selector ".btn-primary" :rules {...})  ;; ✓
(style x :selector ".x" :rules {...})  ;; ✗

;; 3. 토큰으로 값 중복 제거
(theme default :tokens {:space-md "16px"})
(style card :selector ".card" :rules {:p "var(--space-md)"})
(style btn :selector ".btn" :rules {:p "var(--space-md)"})  ;; 토큰 재사용

;; 4. 상태별 스타일 분리
(style btn :selector ".btn" :rules {...})
(style btn-hover :selector ".btn:hover" :rules {...})
(style btn-active :selector ".btn:active" :rules {...})
```

### ✗ 피해야 할 패턴

```lisp
;; 1. 하드코딩된 값 반복
(style card :selector ".card" :rules {:p "16px"})
(style btn :selector ".btn" :rules {:p "16px"})  ;; 반복됨

;; 2. 의미 없는 선택자
(style s1 :selector ".s1" :rules {...})  ;; ✗
(style card-primary :selector ".card-primary" :rules {...})  ;; ✓

;; 3. 과도한 내포
(style a :selector ".a .b .c .d .e" :rules {...})  ;; 복잡함
(style button :selector ".btn" :rules {...})  ;; 단순함
```

---

## 🆘 문제 해결

### 스타일이 적용 안 됨

```lisp
;; 1. 선택자 확인
(style card :selector ".card" :rules {:p "16px"})
;; HTML에서 class="card" 있는지 확인

;; 2. 특이성(Specificity) 확인
;; ID > 클래스 > 태그 선택자
(style card-primary :selector "#card.card-primary" :rules {:bg "blue"})

;; 3. 토큰 변수명 확인
(theme default :tokens {:primary "#2563eb"})
(style btn :selector ".btn" :rules {:bg "var(--primary)"})
;; --primary 변수 정의 확인
```

### CSS 변수 값이 먹지 않음

```lisp
;; 토큰 이름에 하이픈 주의
(theme default :tokens {:primary-color "#2563eb"})  ;; ✓
;; 사용: var(--primary-color)

(theme default :tokens {:primaryColor "#2563eb"})  ;; ✗
;; 사용: var(--primarycolor) - CSS는 소문자 자동 변환
```

---

## 📚 추가 리소스

- [CSS 변수 (Custom Properties)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [CSS 선택자](https://developer.mozilla.org/en-US/docs/Web/CSS/Selectors)
- [Design Tokens](https://www.designtokens.org/)
- [Tailwind CSS](https://tailwindcss.com/) — 영감
