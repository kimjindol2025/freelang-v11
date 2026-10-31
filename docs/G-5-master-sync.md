# G-5 두 master 승격 기록

실행 위치: `forgejo-sync-check` 작업본. 23·25 서버에는 작업하지 않았다.

## 0. 시작 해시

양쪽 fetch 뒤 확인한 원문 해시:

```text
forgejo-sync-check (Forgejo) = 25484a252c15fd9593972d9d2a18536ab0f3a55f
master (GitHub) = 29c57e38b3bd014822cf33fe3df8c1815fee707e
master (Forgejo) = ef20ebc5ab00f768b1a49abc032795c714e05574
```

세 값은 지시된 시작 해시와 모두 일치했다.

## 1. 조상 확인

```text
git merge-base --is-ancestor 29c57e38b3bd014822cf33fe3df8c1815fee707e 25484a252c15fd9593972d9d2a18536ab0f3a55f
GITHUB_MASTER_ANCESTOR_RC=0
git merge-base --is-ancestor ef20ebc5ab00f768b1a49abc032795c714e05574 25484a252c15fd9593972d9d2a18536ab0f3a55f
FORGEJO_MASTER_ANCESTOR_RC=0
```

양쪽 master 모두 승격 후보의 조상이다.

## 2. 백업 태그

```text
Forgejo push: ef20ebc5ab00f768b1a49abc032795c714e05574:refs/tags/pre-sync-20261031
Forgejo ls-remote: ef20ebc5ab00f768b1a49abc032795c714e05574 refs/tags/pre-sync-20261031
GitHub push: 29c57e38b3bd014822cf33fe3df8c1815fee707e:refs/tags/pre-sync-20261031
GitHub ls-remote: 29c57e38b3bd014822cf33fe3df8c1815fee707e refs/tags/pre-sync-20261031
```

각 원격 태그는 해당 원격의 기존 master를 가리킨다. 양쪽 모두 생성 및 조회를 확인했다.

## 3. 승격 대상

승격 대상은 `forgejo-sync-check`의 기준 HEAD 위에 이 보고서만 추가한 커밋이다. G-4 보고서 원문은 `G4_SUMMARY=5/5`를 기록하고 있다. G-5에서는 소스·seed·기대값을 바꾸지 않고 보고서만 추가한다.

## 4. 원격 반영 결과

승격 push 후 master 및 `forgejo-sync-check`의 양쪽 원격 HEAD를 조회해 결과를 이 절에 기록한다.

## 5. G5_SUMMARY

```text
G5_SUMMARY=진행 중
```
