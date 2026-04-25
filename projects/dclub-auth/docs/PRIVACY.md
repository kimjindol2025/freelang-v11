# 개인정보처리방침 — dclub-auth

**시행일**: 2026-04-25
**문의**: privacy@dclub.kr (DPO 김진돌)

dclub-auth(이하 "서비스")는 「개인정보 보호법」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」, EU GDPR 을 준수합니다.

## 1. 수집 항목

### 가입 시 (필수)
- 사용자명 (username)
- 이메일 주소
- 비밀번호 (scrypt 해시만 저장, 평문 미보관)
- 프로필 표시명 (display_name, 선택)

### 자동 수집
- 로그인 IP 주소 (이상 탐지·감사용)
- User-Agent 해시 (디바이스 식별)
- 로그인 시각

### 외부 인증 시
- 소셜 프로바이더 (Google/Kakao/Naver) 의 sub, email, name
- 외부 access_token 은 **저장하지 않음** (즉시 사용 후 폐기)

### MFA 등록 시
- TOTP secret (base32, DB에 저장)
- WebAuthn credential ID + 공개키 JWK (DB에 저장, 개인키는 사용자 디바이스에만)

## 2. 수집 목적

| 목적 | 사용 항목 | 보존 기간 |
|---|---|---|
| 회원 인증 | 사용자명·이메일·비밀번호해시 | 회원 탈퇴 시까지 |
| 이상 로그인 탐지 | IP·UA 해시·시각 | 6개월 |
| 보안 감사 | audit_log 이벤트 | 1년 |
| 이메일 발송 (검증·재설정·알림) | 이메일 | 메일 큐 처리 후 30일 |
| 외부 IdP 연결 | provider sub | 회원 탈퇴 시까지 |

## 3. 보존 기간

- **활성 회원**: 모든 항목 회원 탈퇴 시까지
- **로그인 이력**: **180일** 후 자동 삭제
- **감사 로그**: **365일** 후 자동 삭제 (이벤트 통계만 익명 보존 가능)
- **휴면 회원**: **1년 미로그인** 시 자동 익명화 (사용자명·이메일 deleted_XXX 형식 변경)
- **탈퇴 회원**: 즉시 익명화 + 모든 인증 자료(Passkey/TOTP/외부ID) 삭제, audit_log 의 user_id만 마스킹 후 보존

## 4. 제3자 제공

수집한 개인정보는 **제3자에게 제공하지 않습니다**. 단 법률에 의해 수사기관이 정당한 절차로 요구하는 경우 제공할 수 있습니다.

소셜 로그인 사용 시 외부 IdP(Google/Kakao/Naver)와의 sub·email·name 교환은 **사용자 동의** 하에 이뤄지며, 외부로 신규 데이터를 전송하지 않습니다.

## 5. 처리 위탁

수집한 개인정보는 **자체 인프라에서만** 처리합니다 (auth.dclub.kr 단일 서버). 외부 클라우드·SaaS 위탁 없음.

## 6. 이용자의 권리 (GDPR Article 15-22)

| 권리 | 행사 방법 |
|---|---|
| **열람권** (Right of Access) | `GET /me/export` (Bearer 인증) — 본인의 모든 데이터 JSON 반환 |
| **삭제권** (Right to Erasure) | `DELETE /me` (Bearer + 비번 재확인) — 즉시 익명화 |
| **수정권** (Right to Rectification) | 계정 설정 페이지에서 직접 수정 또는 `/forgot` 비번 재설정 |
| **이동권** (Right to Portability) | `/me/export` JSON 다운로드 (표준 형식) |
| **처리 제한권** | `/mfa/disable` 등 부분 기능 비활성화 가능 |
| **동의 철회권** | 회원 탈퇴 = 모든 동의 철회 |

## 7. 안전성 확보 조치

- 비밀번호: scrypt (RFC 7914, memory-hard) 해시 + per-user salt
- 토큰: SHA256 해시만 DB 저장, 평문 보관 안 함
- 통신: HTTPS 1.2/1.3 강제 (HSTS 1년)
- 이상 탐지: 4룰 가중치 합산 (`/admin/security` 운영자 대시보드)
- Rate limit: 계정·IP 별 brute-force 차단 (5회 실패 → 15분 잠금)
- 감사: 모든 인증 이벤트 영속 (login.ok/fail/locked, token.issue/refresh, key.rotate, data.export, data.delete)
- 키 관리: RSA 2048 자동 30일 회전, 14일 grace 후 정리
- 침해 시 알림: 의심 로그인 발생 시 사용자 메일 통지

## 8. 만 14세 미만 정책

만 14세 미만 가입 금지. 가입 시 자기확인.

## 9. 변경

방침 변경 시 시행 7일 전 공지. 중요 변경(수집 목적 추가 등)은 30일 전 공지 + 재동의.

## 10. DPO (Data Protection Officer)

- 이름: 김진돌
- 이메일: privacy@dclub.kr
- 응답: 영업일 기준 7일 이내

## 11. 관할

대한민국 법률 준거. 분쟁 시 서울중앙지방법원 관할.

---

**관련 문서**: [TERMS.md](./TERMS.md) (이용약관) · [SECURITY.md](./SECURITY.md) (보안 결정 기록)
