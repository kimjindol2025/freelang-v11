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
export interface PackageManifest {
    name: string;
    version: string;
    description?: string;
    flDeps: Record<string, string>;
    exports: string[];
}
export interface SemVer {
    major: number;
    minor: number;
    patch: number;
    raw: string;
}
export declare function parseSemVer(version: string): SemVer | null;
/**
 * semver 비교
 * @returns 양수: a > b, 0: 같음, 음수: a < b
 */
export declare function compareSemVer(a: string, b: string): number;
/**
 * 버전 범위 충족 여부 (^, ~ 간단 구현)
 */
export declare function satisfiesVersion(version: string, range: string): boolean;
export declare class PackageRegistry {
    private packages;
    /**
     * 패키지를 레지스트리에 등록한다.
     * 같은 이름의 패키지는 여러 버전을 동시에 보유할 수 있다.
     */
    register(manifest: PackageManifest): void;
    /**
     * 이름(+선택적 버전)으로 패키지를 찾는다.
     * version 을 생략하면 가장 최신(가장 높은) 버전을 반환한다.
     */
    resolve(name: string, version?: string): PackageManifest | undefined;
    /**
     * 레지스트리에 등록된 모든 패키지 목록 (모든 버전 포함)
     */
    listAll(): PackageManifest[];
    /**
     * 패키지 집합에서 이름 충돌(같은 이름, 다른 버전) 목록 반환.
     * 충돌 없으면 빈 배열.
     */
    checkConflicts(manifests: PackageManifest[]): string[];
}
/**
 * FL 소스 문자열에서 [PKG ...] 블록을 찾아 PackageManifest 로 변환.
 *
 * 문법 예시:
 *   [PKG my-pkg :version "1.0.0" :desc "설명" :deps {other-pkg "^1.0"} :exports [fn1 fn2]]
 */
export declare function parseManifest(src: string): PackageManifest;
/**
 * root 패키지에서 시작해 재귀적으로 의존성을 해결한다.
 * 순환 의존성 감지 시 에러.
 *
 * @returns 해결된 패키지 목록 (root 포함, 의존성 먼저 / 위상 정렬)
 */
export declare function resolveTree(root: string, registry: PackageRegistry, _visited?: Set<string>): PackageManifest[];
//# sourceMappingURL=package-manager.d.ts.map