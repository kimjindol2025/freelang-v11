# NestJS + Prisma Todo App (Traditional Stack Baseline)

## 구조

완전한 엔터프라이즈 Todo 앱을 NestJS + Prisma로 구현한 기준선입니다.

### 파일 구성

```
src/
├── main.ts                         # 앱 진입점
├── app.module.ts                   # 루트 모듈
├── prisma.service.ts               # Prisma DB 연결
├── auth/
│   ├── auth.controller.ts          # 인증 엔드포인트
│   ├── auth.service.ts             # 인증 로직
│   ├── auth.module.ts              # 인증 모듈
│   ├── jwt.strategy.ts             # Passport JWT 전략
│   └── jwt-auth.guard.ts           # JWT 검증 가드
├── todos/
│   ├── todos.controller.ts         # Todo CRUD 엔드포인트
│   ├── todos.service.ts            # Todo 비즈니스 로직
│   ├── todos.module.ts             # Todo 모듈
│   └── dto/
│       ├── create-todo.dto.ts      # 생성 DTO
│       └── update-todo.dto.ts      # 수정 DTO
├── users/
│   ├── users.controller.ts         # 사용자 조회 엔드포인트
│   ├── users.service.ts            # 사용자 조회 로직
│   └── users.module.ts             # 사용자 모듈
prisma/
├── schema.prisma                   # DB 스키마
└── migrations/                     # 마이그레이션
```

## 코드 측정

```
파일 개수: 16개
├─ TypeScript: 14개 (src/**/*.ts)
├─ Prisma: 1개 (schema.prisma)
├─ Config: 1개 (tsconfig.json)
└─ Setup: 2개 (package.json, .env.example)

총 라인 수: 주요 코드만 계산
├─ main.ts: 7줄
├─ app.module.ts: 24줄
├─ prisma.service.ts: 13줄
├─ auth/auth.service.ts: 44줄
├─ auth/auth.controller.ts: 20줄
├─ auth/jwt.strategy.ts: 20줄
├─ auth/jwt-auth.guard.ts: 4줄
├─ auth/auth.module.ts: 25줄
├─ todos/todos.service.ts: 42줄
├─ todos/todos.controller.ts: 50줄
├─ todos/todos.module.ts: 11줄
├─ todos/dto/create-todo.dto.ts: 3줄
├─ todos/dto/update-todo.dto.ts: 3줄
├─ users/users.service.ts: 25줄
├─ users/users.controller.ts: 16줄
├─ users/users.module.ts: 11줄
├─ prisma/schema.prisma: 30줄
└─ tsconfig.json: 20줄

합계: ~428줄

보일러플레이트 비율: ~55%
├─ Decorators (@Module, @Controller, @Injectable, @UseGuards 등): ~60줄
├─ Import/Export: ~40줄
├─ 타입 정의 (DTO, interface): ~30줄
├─ 모듈 설정: ~50줄
└─ 실제 비즈니스 로직: ~248줄

설정 파일 개수: 5개
├─ package.json
├─ tsconfig.json
├─ .env.example
├─ nest-cli.json (생략)
└─ .gitignore (생략)
```

## 특징

### 강점
✅ 타입 안전성 (TypeScript)
✅ 데코레이터 기반 선언적 구문
✅ 의존성 주입 (DI)
✅ 모듈 기반 구조
✅ ORM (Prisma) 통합

### 약점
❌ 많은 보일러플레이트 코드
❌ 많은 파일 분산 (16개)
❌ 높은 학습곡선
❌ 불필요한 레이어링 (controller → service → repository)
❌ 반복되는 CRUD 패턴

## 빌드 및 실행

```bash
# 의존성 설치
npm install

# DB 마이그레이션
npx prisma migrate dev

# 빌드
npm run build

# 개발 모드
npm run dev

# 프로덕션 시작
npm start
```

## API 엔드포인트

### 인증
```
POST /auth/register          # 회원가입
POST /auth/login             # 로그인
```

### Todo (JWT 필수)
```
GET /todos                   # 목록 조회
POST /todos                  # 생성
GET /todos/:id              # 상세 조회
PATCH /todos/:id            # 수정
DELETE /todos/:id           # 삭제
```

### 사용자 (JWT 필수)
```
GET /users                   # 사용자 목록
GET /users/:id              # 사용자 상세
```
