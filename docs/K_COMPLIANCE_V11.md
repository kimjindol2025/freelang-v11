# K-Compliance v11 port

Source: `kimjindol2025/freelang-korean` `src/kstdlib/compliance/*.free`  
Target: `kimjindol2025/freelang-v11` `lib/k-compliance.fl`

This is a **language port**, not a shared binary. Same checksum rules, AFJ syntax.

## What is portable now

| Spec name | v11 name | Status |
|---|---|---|
| 주민등록번호_유효성확인 | same + `kc/rrn-valid?` | pure |
| 사업자등록번호_유효성확인 | same + `kc/brn-valid?` | pure |
| 법인등록번호_유효성확인 | same + `kc/crn-valid?` | pure |
| 국내휴대폰번호_유효성확인 | same + `kc/mobile-valid?` | pure |
| 국내전화번호_유효성확인 | same + `kc/phone-valid?` | pure |
| 개인정보_비식별화 | same + `kc/deidentify` | pure |
| 민감정보_마스킹 | same + `kc/mask` | pure |
| PIPA_개인정보수집동의_검증 | same + `kc/pipa-consent?` | pure |
| ISMS_보안수준_평가 | same + `kc/isms-score` | pure |
| 카드번호_룬검증 / PCI_DSS_신용카드검증 | same + `kc/luhn?` `kc/pci-card?` | pure |
| 접근로그_기록 / 보안이벤트_로그 / 감사로그_조회 | store-in / store-out | pure, no hidden global |
| 권한_확인 / 역할_권한_확인 / 세션_유효성확인 | take `$acl` map | pure |
| SHA256_해시화 / ARIA_암호화 / SEED_암호화 | host stub | `error host-fn-required:*` |
| 개인정보_암호화 / 복호화 / 서명 | host stub | same |
| 파일_체크섬검증 | hashes `$content` | still needs host sha256 |

## API change vs korean

v11 values are immutable. Audit and ACL no longer mutate a module global.

```fl
(load "lib/k-compliance.fl")
(주민등록번호_유효성확인 "900101-1000006")
(def $acl (권한_부여 (kc/empty-acl) "u1" "읽기"))
(권한_확인 $acl "u1" "읽기")
```

## Shared test vectors

- RRN `900101-1000006` → true (checksum 6)
- BRN `123-45-67891` → true
- BRN `120-81-50007` → true
- CRN `110111-0000002` → true
- PAN `4111111111111111` Luhn → true (test VISA, not a real card)

## Not done

- Host ARIA/SEED/SHA-256/RSA wiring via `(use crypto)`
- File read path behind `--allow-read`
- Runtime proof on this machine (v11 CLI is not in the sandbox)
- Merge to `master`
