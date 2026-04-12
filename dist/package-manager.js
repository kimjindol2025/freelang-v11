"use strict";
/**
 * FreeLang v9 Package Manager — Interpreter Level
 * Phase 81: FL 언어 레벨 패키지 관리 시스템
 *
 * vpm-cli.ts 와는 다른 계층 — 인터프리터 레벨에서 동작하는 패키지 관리 런타임.
 * FL 소스 내 [PKG ...] 블록을 파싱하고 의존성 트리를 해결한다.
 *
 * 문법:
 *   [PKG my-pkg :version "1.0.0" :desc "설명" :deps {other-pkg "^1.0"} :exports [fn1 fn2]]
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageRegistry = void 0;
exports.parseSemVer = parseSemVer;
exports.compareSemVer = compareSemVer;
exports.satisfiesVersion = satisfiesVersion;
exports.parseManifest = parseManifest;
exports.resolveTree = resolveTree;
function parseSemVer(version) {
    const clean = version.replace(/^[\^~>=<v]+/, '').trim();
    const m = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!m)
        return null;
    return {
        major: parseInt(m[1], 10),
        minor: parseInt(m[2], 10),
        patch: parseInt(m[3], 10),
        raw: version,
    };
}
/**
 * semver 비교
 * @returns 양수: a > b, 0: 같음, 음수: a < b
 */
function compareSemVer(a, b) {
    const av = parseSemVer(a);
    const bv = parseSemVer(b);
    if (!av || !bv)
        return 0;
    if (av.major !== bv.major)
        return av.major - bv.major;
    if (av.minor !== bv.minor)
        return av.minor - bv.minor;
    return av.patch - bv.patch;
}
/**
 * 버전 범위 충족 여부 (^, ~ 간단 구현)
 */
function satisfiesVersion(version, range) {
    const v = parseSemVer(version);
    if (!v)
        return false;
    // 정확한 버전
    if (!range.startsWith('^') && !range.startsWith('~') && !range.startsWith('>=')) {
        return version === range;
    }
    const r = parseSemVer(range);
    if (!r)
        return false;
    if (range.startsWith('^')) {
        // ^1.2.3 → >=1.2.3 <2.0.0
        return v.major === r.major && compareSemVer(version, range) >= 0;
    }
    if (range.startsWith('~')) {
        // ~1.2.3 → >=1.2.3 <1.3.0
        return v.major === r.major && v.minor === r.minor && compareSemVer(version, range) >= 0;
    }
    if (range.startsWith('>=')) {
        return compareSemVer(version, range) >= 0;
    }
    return false;
}
// ---------------------------------------------------------------------------
// PackageRegistry
// ---------------------------------------------------------------------------
class PackageRegistry {
    constructor() {
        this.packages = new Map();
    }
    /**
     * 패키지를 레지스트리에 등록한다.
     * 같은 이름의 패키지는 여러 버전을 동시에 보유할 수 있다.
     */
    register(manifest) {
        const existing = this.packages.get(manifest.name) ?? [];
        this.packages.set(manifest.name, [...existing, manifest]);
    }
    /**
     * 이름(+선택적 버전)으로 패키지를 찾는다.
     * version 을 생략하면 가장 최신(가장 높은) 버전을 반환한다.
     */
    resolve(name, version) {
        const list = this.packages.get(name);
        if (!list || list.length === 0)
            return undefined;
        if (!version) {
            // 버전 미지정 → 가장 높은 버전
            return list.reduce((best, cur) => compareSemVer(cur.version, best.version) > 0 ? cur : best);
        }
        // 정확한 버전 우선 탐색
        const exact = list.find((m) => m.version === version);
        if (exact)
            return exact;
        // 범위 매칭
        const matched = list.filter((m) => satisfiesVersion(m.version, version));
        if (matched.length === 0)
            return undefined;
        return matched.reduce((best, cur) => compareSemVer(cur.version, best.version) > 0 ? cur : best);
    }
    /**
     * 레지스트리에 등록된 모든 패키지 목록 (모든 버전 포함)
     */
    listAll() {
        const result = [];
        for (const versions of this.packages.values()) {
            result.push(...versions);
        }
        return result;
    }
    /**
     * 패키지 집합에서 이름 충돌(같은 이름, 다른 버전) 목록 반환.
     * 충돌 없으면 빈 배열.
     */
    checkConflicts(manifests) {
        const seen = new Map(); // name → version
        const conflicts = [];
        for (const m of manifests) {
            if (seen.has(m.name)) {
                const existing = seen.get(m.name);
                if (existing !== m.version) {
                    conflicts.push(`${m.name}: ${existing} vs ${m.version}`);
                }
            }
            else {
                seen.set(m.name, m.version);
            }
        }
        return conflicts;
    }
}
exports.PackageRegistry = PackageRegistry;
// ---------------------------------------------------------------------------
// FL 소스 파싱 — [PKG ...] 블록
// ---------------------------------------------------------------------------
/**
 * FL 소스 문자열에서 [PKG ...] 블록을 찾아 PackageManifest 로 변환.
 *
 * 문법 예시:
 *   [PKG my-pkg :version "1.0.0" :desc "설명" :deps {other-pkg "^1.0"} :exports [fn1 fn2]]
 */
function parseManifest(src) {
    // [PKG ...] 블록 추출 (중첩 대괄호 고려)
    const pkgStart = src.indexOf('[PKG ');
    if (pkgStart === -1) {
        throw new Error('parseManifest: [PKG ...] 블록을 찾을 수 없습니다');
    }
    // 중첩된 괄호 고려하여 블록 끝 찾기
    let depth = 0;
    let end = -1;
    for (let i = pkgStart; i < src.length; i++) {
        if (src[i] === '[')
            depth++;
        else if (src[i] === ']') {
            depth--;
            if (depth === 0) {
                end = i;
                break;
            }
        }
    }
    if (end === -1)
        throw new Error('parseManifest: [PKG 블록이 닫히지 않았습니다');
    const block = src.slice(pkgStart + 1, end).trim(); // 양쪽 [] 제거
    // block: "PKG my-pkg :version "1.0.0" ..."
    // 토큰화 (간단한 state machine)
    const tokens = tokenizeBlock(block);
    if (tokens[0] !== 'PKG')
        throw new Error('parseManifest: 첫 토큰이 PKG 아님');
    const name = tokens[1];
    if (!name || name.startsWith(':'))
        throw new Error('parseManifest: 패키지 이름 누락');
    let version = '0.0.0';
    let description;
    let flDeps = {};
    let exports = [];
    // 키-값 파싱
    let i = 2;
    while (i < tokens.length) {
        const key = tokens[i];
        i++;
        if (key === ':version') {
            version = tokens[i] ?? '0.0.0';
            i++;
        }
        else if (key === ':desc' || key === ':description') {
            description = tokens[i];
            i++;
        }
        else if (key === ':deps') {
            // {pkg "ver" pkg2 "ver2"} 형태
            const depsRaw = tokens[i] ?? '';
            i++;
            flDeps = parseDepsBlock(depsRaw);
        }
        else if (key === ':exports') {
            // [fn1 fn2 fn3] 형태
            const exportsRaw = tokens[i] ?? '';
            i++;
            exports = parseExportsList(exportsRaw);
        }
        else {
            // 알 수 없는 키 — 건너뜀
            i++;
        }
    }
    return { name, version, description, flDeps, exports };
}
/** 간단한 토크나이저: 문자열, 중괄호블록, 대괄호블록, 심볼 분리 */
function tokenizeBlock(src) {
    const tokens = [];
    let i = 0;
    const len = src.length;
    while (i < len) {
        // 공백 건너뜀
        if (/\s/.test(src[i])) {
            i++;
            continue;
        }
        // 문자열
        if (src[i] === '"') {
            let j = i + 1;
            while (j < len && src[j] !== '"') {
                if (src[j] === '\\')
                    j++; // escape
                j++;
            }
            tokens.push(src.slice(i + 1, j));
            i = j + 1;
            continue;
        }
        // 중괄호 블록 { ... }
        if (src[i] === '{') {
            let depth = 0, j = i;
            while (j < len) {
                if (src[j] === '{')
                    depth++;
                else if (src[j] === '}') {
                    depth--;
                    if (depth === 0) {
                        j++;
                        break;
                    }
                }
                j++;
            }
            tokens.push(src.slice(i, j));
            i = j;
            continue;
        }
        // 대괄호 블록 [ ... ]
        if (src[i] === '[') {
            let depth = 0, j = i;
            while (j < len) {
                if (src[j] === '[')
                    depth++;
                else if (src[j] === ']') {
                    depth--;
                    if (depth === 0) {
                        j++;
                        break;
                    }
                }
                j++;
            }
            tokens.push(src.slice(i, j));
            i = j;
            continue;
        }
        // 일반 심볼/키워드
        let j = i;
        while (j < len && !/[\s"{}[\]]/.test(src[j]))
            j++;
        tokens.push(src.slice(i, j));
        i = j;
    }
    return tokens.filter(Boolean);
}
/** {pkg "^1.0" pkg2 "2.0.0"} → Record<string, string> */
function parseDepsBlock(raw) {
    const result = {};
    if (!raw.startsWith('{'))
        return result;
    const inner = raw.slice(1, raw.lastIndexOf('}')).trim();
    const toks = tokenizeBlock(inner);
    for (let i = 0; i + 1 < toks.length; i += 2) {
        result[toks[i]] = toks[i + 1] ?? '*';
    }
    return result;
}
/** [fn1 fn2 fn3] → string[] */
function parseExportsList(raw) {
    if (!raw.startsWith('['))
        return [];
    const inner = raw.slice(1, raw.lastIndexOf(']')).trim();
    return inner.split(/\s+/).filter(Boolean);
}
// ---------------------------------------------------------------------------
// 의존성 트리 해결
// ---------------------------------------------------------------------------
/**
 * root 패키지에서 시작해 재귀적으로 의존성을 해결한다.
 * 순환 의존성 감지 시 에러.
 *
 * @returns 해결된 패키지 목록 (root 포함, 의존성 먼저 / 위상 정렬)
 */
function resolveTree(root, registry, _visited = new Set()) {
    if (_visited.has(root)) {
        throw new Error(`resolveTree: 순환 의존성 감지 — "${root}"`);
    }
    const manifest = registry.resolve(root);
    if (!manifest) {
        throw new Error(`resolveTree: 패키지 "${root}"를 레지스트리에서 찾을 수 없습니다`);
    }
    _visited.add(root);
    const result = [];
    // 의존성 먼저 해결 (DFS)
    for (const [depName, depVersion] of Object.entries(manifest.flDeps)) {
        const depManifest = registry.resolve(depName, depVersion);
        if (!depManifest) {
            throw new Error(`resolveTree: 의존성 "${depName}@${depVersion}"를 찾을 수 없습니다 (요청: "${root}")`);
        }
        // 이미 결과에 포함된 패키지는 건너뜀
        if (!result.some((m) => m.name === depManifest.name && m.version === depManifest.version)) {
            const subTree = resolveTree(depManifest.name, registry, new Set(_visited));
            for (const m of subTree) {
                if (!result.some((r) => r.name === m.name && r.version === m.version)) {
                    result.push(m);
                }
            }
        }
    }
    result.push(manifest);
    return result;
}
//# sourceMappingURL=package-manager.js.map