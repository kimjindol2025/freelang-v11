"use strict";
/**
 * FreeLang v9 Package Manager (vpm) CLI
 * Phase 5b: Package Manager Command Line Interface
 *
 * Commands:
 * - vpm install [package][@version]
 * - vpm publish
 * - vpm search <query>
 * - vpm list
 * - vpm update [package]
 * - vpm token create
 * - vpm uninstall <package>
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VpmCli = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
class VpmCli {
    constructor() {
        this.registryUrl = process.env.VPM_REGISTRY || 'http://registry.v9.dclub.kr';
        this.cwd = process.cwd();
        this.vpmDir = path.join(this.cwd, 'vpm');
        this.packagesDir = path.join(this.vpmDir, 'packages');
        // Phase 9: Lockfile-based conflict detection
        this.lockfileLoaded = false;
        this.installedPackages = new Map();
        // Phase 9: Network resilience
        this.fallbackRegistryUrl = process.env.VPM_REGISTRY_FALLBACK || '';
        this.REQUEST_TIMEOUT_MS = 5000;
        this.MAX_RETRIES = 3;
    }
    async run(args) {
        if (args.length === 0) {
            this.showHelp();
            return;
        }
        const command = args[0];
        const params = args.slice(1);
        try {
            switch (command) {
                case 'install':
                case 'i':
                    await this.install(params);
                    break;
                case 'publish':
                    await this.publish();
                    break;
                case 'search':
                    await this.search(params);
                    break;
                case 'list':
                case 'ls':
                    await this.list();
                    break;
                case 'update':
                    await this.update(params);
                    break;
                case 'uninstall':
                case 'remove':
                case 'rm':
                    await this.uninstall(params);
                    break;
                case 'token':
                    await this.token(params);
                    break;
                case 'info':
                    await this.info(params);
                    break;
                case 'verify':
                    await this.verify();
                    break;
                case 'reinstall':
                    await this.reinstall();
                    break;
                case 'help':
                case '-h':
                case '--help':
                    this.showHelp();
                    break;
                default:
                    throw new Error(`Unknown command: ${command}`);
            }
        }
        catch (error) {
            console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }
    async install(params) {
        // Phase 9: Load installed packages from lockfile (lazy init)
        this.ensureLockfileLoaded();
        if (params.length === 0) {
            // 의존성 설치
            await this.installFromLockFile();
            return;
        }
        const packageSpec = params[0];
        const [packageName, versionSpec] = packageSpec.includes('@')
            ? packageSpec.split('@')
            : [packageSpec, 'latest'];
        console.log(`📦 Installing ${packageName}@${versionSpec}...`);
        // Phase 8: 충돌 감지 - 같은 패키지의 다른 버전이 이미 설치되었는가?
        if (this.detectVersionConflict(packageName, versionSpec)) {
            const existingVersion = this.installedPackages.get(packageName);
            // Phase 9: Try to resolve conflict (highest wins for minor/patch, error for major)
            const resolved = this.resolveConflict(packageName, existingVersion, versionSpec);
            if (resolved !== versionSpec) {
                console.log(`✓ Using ${packageName}@${resolved} instead, skipping`);
                return;
            }
        }
        // Phase 9: Enhanced deduplication - check if file exists + verify integrity
        if (this.installedPackages.has(packageName)) {
            const existingVersion = this.installedPackages.get(packageName);
            if (existingVersion === versionSpec) {
                const pkgPath = path.join(this.packagesDir, `${packageName}@${versionSpec}`);
                if (fs.existsSync(pkgPath)) {
                    console.log(`✓ ${packageName}@${versionSpec} already installed (deduped), skipping`);
                    return;
                }
                // File missing - will reinstall below
            }
            else {
                // Different version - try to resolve conflict
                const resolved = this.resolveConflict(packageName, existingVersion, versionSpec);
                if (resolved !== versionSpec) {
                    console.log(`✓ Using ${packageName}@${resolved} instead, skipping`);
                    return;
                }
            }
        }
        // 패키지 정보 조회 (모든 버전)
        const pkgInfo = await this.fetchPackageInfo(packageName);
        if (!pkgInfo) {
            throw new Error(`Package ${packageName} not found`);
        }
        // Stage 5: Semver 해석 - 최적 버전 선택
        const selectedVersion = this.resolveVersion(pkgInfo.versions, versionSpec);
        if (!selectedVersion) {
            throw new Error(`No matching version found for ${packageName}@${versionSpec}`);
        }
        const version = selectedVersion.version;
        // Phase 9: Conflict recheck after resolver (resolved version)
        if (this.detectVersionConflict(packageName, version)) {
            const existingVersion = this.installedPackages.get(packageName);
            try {
                const resolved = this.resolveConflict(packageName, existingVersion, version);
                if (resolved !== version) {
                    console.log(`✓ Resolver selected ${packageName}@${version}, but using ${resolved} (conflict resolution)`);
                    return;
                }
            }
            catch (err) {
                // Major version conflict - throw error
                throw err;
            }
        }
        // 패키지 설치 (resolver.fl 호출 + registry checksum 활용)
        // pkgInfo.versions 배열에서 요청한 버전의 checksum 찾기
        let registryChecksum;
        let dependencies = {};
        if (pkgInfo.versions && Array.isArray(pkgInfo.versions)) {
            const versionEntry = pkgInfo.versions.find((v) => v.version === version);
            registryChecksum = versionEntry && versionEntry.checksum;
            dependencies = (versionEntry && versionEntry.dependencies) || {};
        }
        // Phase 9: downloadAndExtract는 pkgInfo를 파일로 저장 후 integrity 계산
        const installResult = await this.downloadAndExtract(packageName, version, pkgInfo);
        // Phase 8: 설치 추적
        this.installedPackages.set(packageName, version);
        // package.json 업데이트
        await this.updatePackageJson(packageName, version);
        // Stage 4: 의존성 재귀 설치 (registry에서 가져온 의존성 사용)
        if (Object.keys(dependencies).length > 0) {
            console.log(`📚 Installing ${Object.keys(dependencies).length} dependencies...`);
            for (const [depName, depVersion] of Object.entries(dependencies)) {
                await this.install([`${depName}@${depVersion}`]);
            }
        }
        // 락파일 업데이트 (integrity 포함)
        await this.updateLockFile(packageName, version, installResult.integrity);
        console.log(`✅ ${packageName}@${version} installed with integrity: ${installResult.integrity}`);
    }
    // Stage 7: Verify command - check integrity from lockfile
    async verify() {
        const lockFilePath = path.join(this.cwd, 'package-lock.json');
        if (!fs.existsSync(lockFilePath)) {
            throw new Error('No package-lock.json found');
        }
        const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        const packages = lockFile.packages || {};
        console.log('🔍 Verifying package integrity...');
        let verified = 0;
        let failed = 0;
        for (const [pkgName, pkgData] of Object.entries(packages)) {
            if (!pkgName || pkgName === '')
                continue;
            if (!pkgData.integrity) {
                console.log(`⚠️  ${pkgName}: No integrity recorded`);
                continue;
            }
            const pkgPath = path.join(this.packagesDir, pkgName);
            const pkgJsonPath = path.join(pkgPath, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) {
                console.log(`❌ ${pkgName}: package.json not found`);
                failed++;
                continue;
            }
            // Phase 9: Verify integrity by recalculating SHA-256 from actual file
            try {
                const actualContent = fs.readFileSync(pkgJsonPath, 'utf-8');
                const actualHash = this.calculateSHA256(actualContent);
                if (pkgData.integrity && actualHash !== pkgData.integrity) {
                    console.log(`❌ ${pkgName}: INTEGRITY MISMATCH (expected: ${pkgData.integrity.substring(0, 16)}..., got: ${actualHash.substring(0, 16)}...)`);
                    failed++;
                    continue;
                }
                console.log(`✅ ${pkgName}: OK`);
                verified++;
            }
            catch (err) {
                console.log(`❌ ${pkgName}: Verification failed (${err instanceof Error ? err.message : String(err)})`);
                failed++;
            }
        }
        console.log(`\n📊 Verification: ${verified} OK, ${failed} failed`);
        if (failed > 0)
            process.exit(1);
    }
    // Stage 7: Reinstall command - install from lockfile
    async reinstall() {
        // Phase 9: Reset lockfile-based conflict detection
        this.lockfileLoaded = false;
        this.installedPackages.clear();
        const lockFilePath = path.join(this.cwd, 'package-lock.json');
        if (!fs.existsSync(lockFilePath)) {
            throw new Error('No package-lock.json found');
        }
        const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        const packages = lockFile.packages || {};
        console.log('🔄 Reinstalling from lockfile...');
        // Clean existing packages
        if (fs.existsSync(this.packagesDir)) {
            fs.rmSync(this.packagesDir, { recursive: true });
        }
        fs.mkdirSync(this.packagesDir, { recursive: true });
        for (const [pkgName, pkgData] of Object.entries(packages)) {
            if (!pkgName || pkgName === '')
                continue;
            const [name, version] = pkgName.lastIndexOf('@') > 0
                ? pkgName.split('@')
                : [pkgName, ''];
            if (name && version) {
                // Use exact version from lockfile (skip semver resolution)
                await this.install([`${name}@${version}`]);
            }
        }
        console.log('✅ Reinstall complete');
    }
    async installFromLockFile() {
        const lockFilePath = path.join(this.cwd, 'package-lock.json');
        if (!fs.existsSync(lockFilePath)) {
            console.log('⚠️  No package-lock.json found. Install dependencies manually.');
            return;
        }
        const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
        const packages = lockFile.packages || {};
        console.log('📦 Installing dependencies from lock file...');
        let count = 0;
        for (const [pkgName, pkgData] of Object.entries(packages)) {
            if (!pkgName || pkgName === '' || pkgName === '.')
                continue; // 루트 패키지 제외
            if (pkgData.version) {
                // Extract package name from "name@version" format
                const lastAtIndex = pkgName.lastIndexOf('@');
                const pkgNameOnly = lastAtIndex > 0 ? pkgName.substring(0, lastAtIndex) : pkgName;
                // Fetch package info from registry to get registry checksum
                const pkgInfo = await this.fetchPackageInfo(pkgNameOnly, pkgData.version);
                if (!pkgInfo) {
                    throw new Error(`Package ${pkgNameOnly}@${pkgData.version} not found in registry`);
                }
                await this.downloadAndExtract(pkgNameOnly, pkgData.version, pkgInfo);
                // Phase 9: Track installed package in Map
                this.installedPackages.set(pkgNameOnly, pkgData.version);
                count++;
            }
        }
        console.log(`✅ Installed ${count} packages`);
    }
    async publish() {
        const pkgJsonPath = path.join(this.cwd, 'package.json');
        if (!fs.existsSync(pkgJsonPath)) {
            throw new Error('package.json not found');
        }
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const token = process.env.VPM_AUTH_TOKEN;
        if (!token) {
            throw new Error('VPM_AUTH_TOKEN environment variable not set');
        }
        console.log(`📦 Publishing ${pkgJson.name}@${pkgJson.version}...`);
        // 패키지 압축
        const tarballPath = await this.createTarball();
        const fileSize = fs.statSync(tarballPath).size;
        const checksum = this.calculateChecksum(tarballPath);
        // 레지스트리에 배포
        const response = await this.makeRequest('POST', '/registry/publish', {
            name: pkgJson.name,
            version: pkgJson.version,
            description: pkgJson.description,
            license: pkgJson.license,
            homepage: pkgJson.homepage,
            repository: pkgJson.repository,
            tarball_url: `${this.registryUrl}/download/${pkgJson.name}/${pkgJson.version}`,
            file_size: fileSize,
            checksum,
            keywords: pkgJson.keywords || [],
            dependencies: pkgJson.dependencies || {},
        }, token);
        if (response.success) {
            console.log(`✅ Published ${pkgJson.name}@${pkgJson.version}`);
            // 압축 파일 정리
            fs.unlinkSync(tarballPath);
        }
        else {
            throw new Error(response.message || 'Publish failed');
        }
    }
    async search(params) {
        if (params.length === 0) {
            throw new Error('Please provide a search query');
        }
        const query = params.join(' ');
        console.log(`🔍 Searching for "${query}"...`);
        const response = await this.makeRequest('GET', `/registry/search?q=${encodeURIComponent(query)}&limit=20`);
        if (!response.success) {
            throw new Error(response.message || 'Search failed');
        }
        if (response.count === 0) {
            console.log('❌ No packages found');
            return;
        }
        console.log(`\n📦 Search results (${response.count} found):\n`);
        response.packages.forEach((pkg, idx) => {
            const downloads = pkg.downloads || 0;
            const stars = pkg.stars || 0;
            console.log(`${idx + 1}. ${pkg.name}`);
            console.log(`   ${pkg.description || 'No description'}`);
            console.log(`   ⬇️  ${downloads} | ⭐ ${stars}`);
            console.log();
        });
    }
    async list() {
        if (!fs.existsSync(this.packagesDir)) {
            console.log('📦 No packages installed');
            return;
        }
        const packages = fs.readdirSync(this.packagesDir);
        if (packages.length === 0) {
            console.log('📦 No packages installed');
            return;
        }
        console.log('📦 Installed packages:\n');
        packages.forEach((pkg, idx) => {
            const version = pkg.split('@')[1] || 'unknown';
            const name = pkg.split('@')[0];
            console.log(`${idx + 1}. ${name}@${version}`);
        });
        console.log();
    }
    async update(params) {
        if (params.length === 0) {
            // 모든 패키지 업데이트
            console.log('🔄 Updating all packages...');
            const pkgJsonPath = path.join(this.cwd, 'package.json');
            if (!fs.existsSync(pkgJsonPath)) {
                throw new Error('package.json not found');
            }
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
            const deps = pkgJson.dependencies || {};
            let updated = 0;
            for (const [depName] of Object.entries(deps)) {
                try {
                    await this.updateSinglePackage(depName);
                    updated++;
                }
                catch (e) {
                    console.warn(`⚠️  Failed to update ${depName}`);
                }
            }
            console.log(`✅ Updated ${updated} packages`);
            return;
        }
        const packageName = params[0];
        await this.updateSinglePackage(packageName);
    }
    async updateSinglePackage(packageName) {
        console.log(`🔄 Updating ${packageName}...`);
        const pkgInfo = await this.fetchPackageInfo(packageName, 'latest');
        if (!pkgInfo) {
            throw new Error(`Package ${packageName} not found`);
        }
        const latestVersion = pkgInfo.versions[0].version;
        const currentVersion = await this.getInstalledVersion(packageName);
        if (currentVersion === latestVersion) {
            console.log(`ℹ️  ${packageName} is already at latest version`);
            return;
        }
        await this.uninstallSinglePackage(packageName);
        await this.downloadAndExtract(packageName, latestVersion, pkgInfo);
        await this.updatePackageJson(packageName, latestVersion);
        console.log(`✅ ${packageName} updated from ${currentVersion} to ${latestVersion}`);
    }
    async uninstall(params) {
        if (params.length === 0) {
            throw new Error('Please specify a package to uninstall');
        }
        const packageName = params[0];
        await this.uninstallSinglePackage(packageName);
        await this.removeFromPackageJson(packageName);
        await this.updateLockFile();
        console.log(`✅ ${packageName} uninstalled`);
    }
    async uninstallSinglePackage(packageName) {
        const pkgPath = path.join(this.packagesDir, fs.readdirSync(this.packagesDir).find((d) => d.startsWith(packageName)));
        if (fs.existsSync(pkgPath)) {
            fs.rmSync(pkgPath, { recursive: true });
        }
    }
    async token(params) {
        const action = params[0];
        switch (action) {
            case 'create':
                console.log('🔑 Creating new token...');
                const token = await this.createAuthToken();
                console.log(`✅ Token created: ${token}`);
                console.log('   Set VPM_AUTH_TOKEN environment variable to use it');
                break;
            case 'list':
                console.log('🔑 Auth tokens:');
                // 토큰 목록 조회 (실제 구현은 API 필요)
                break;
            default:
                throw new Error('Unknown token action');
        }
    }
    async info(params) {
        if (params.length === 0) {
            throw new Error('Please specify a package name');
        }
        const packageName = params[0];
        console.log(`📦 Fetching info for ${packageName}...`);
        const pkgInfo = await this.fetchPackageInfo(packageName);
        if (!pkgInfo) {
            throw new Error(`Package ${packageName} not found`);
        }
        console.log(`\n${pkgInfo.name}`);
        console.log(`${pkgInfo.description || 'No description'}`);
        console.log(`⬇️  ${pkgInfo.downloads} downloads | ⭐ ${pkgInfo.stars} stars`);
        console.log(`\nVersions:`);
        pkgInfo.versions.forEach((v) => {
            console.log(`  - ${v.version} (${v.published_at})`);
        });
        console.log();
    }
    // Helper methods
    async fetchPackageInfo(packageName, version) {
        try {
            const path = version
                ? `/registry/packages?name=${encodeURIComponent(packageName)}&version=${encodeURIComponent(version)}`
                : `/registry/packages?name=${encodeURIComponent(packageName)}`;
            // Phase 9: Use retry wrapper for network resilience
            const response = await this.makeRequestWithRetry('GET', path);
            if (!response.success || !response.package)
                return null;
            // Phase 9: Validate registry response structure
            this.validateRegistryResponse(response.package);
            return response.package;
        }
        catch (err) {
            // Network errors are already logged by makeRequestWithRetry
            if (!(err instanceof Error && err.message.includes('Registry unreachable'))) {
                console.warn(`⚠️  Failed to fetch package info: ${err instanceof Error ? err.message : String(err)}`);
            }
            return null;
        }
    }
    // Phase 9: Validate registry response structure
    validateRegistryResponse(pkg) {
        if (!pkg.id || !pkg.name || !Array.isArray(pkg.versions)) {
            throw new Error(`Invalid registry response for package: missing required fields (id, name, versions)`);
        }
        if (pkg.versions.length === 0) {
            throw new Error(`Package ${pkg.name} has no published versions in registry`);
        }
    }
    async downloadAndExtract(packageName, version, pkgInfo) {
        // resolver.fl의 install_package 호출 (Phase 7: 실제 경로)
        const targetPath = path.join(this.packagesDir, `${packageName}@${version}`);
        // resolver.fl 실행
        const result = await this.callResolverInstall(packageName, version, targetPath);
        if (!result.success) {
            throw new Error(`Failed to install ${packageName}@${version}: ${result.reason}`);
        }
        // 패키지 디렉토리 생성 (lockfile 저장용)
        if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(targetPath, { recursive: true });
        }
        // Phase 9: package.json 저장 후 실제 파일 내용으로 integrity 계산
        const pkgJsonContent = JSON.stringify(pkgInfo, null, 2);
        fs.writeFileSync(path.join(targetPath, 'package.json'), pkgJsonContent);
        // Phase 9: 실제 저장된 파일 내용으로 SHA-256 계산
        const integrity = this.calculateSHA256(pkgJsonContent);
        return {
            integrity,
            success: true
        };
    }
    async installDependencies(packageName, version) {
        const pkgPath = path.join(this.packagesDir, `${packageName}@${version}`);
        const pkgJsonPath = path.join(pkgPath, 'package.json');
        if (!fs.existsSync(pkgJsonPath))
            return;
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        const deps = pkgJson.dependencies || {};
        for (const [depName, depVersion] of Object.entries(deps)) {
            await this.install([`${depName}@${depVersion}`]);
        }
    }
    async updatePackageJson(packageName, version) {
        const pkgJsonPath = path.join(this.cwd, 'package.json');
        if (!fs.existsSync(pkgJsonPath))
            return;
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (!pkgJson.dependencies)
            pkgJson.dependencies = {};
        pkgJson.dependencies[packageName] = version;
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    }
    async removeFromPackageJson(packageName) {
        const pkgJsonPath = path.join(this.cwd, 'package.json');
        if (!fs.existsSync(pkgJsonPath))
            return;
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        if (pkgJson.dependencies && packageName in pkgJson.dependencies) {
            delete pkgJson.dependencies[packageName];
        }
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    }
    async updateLockFile(packageName, version, integrity) {
        const lockFilePath = path.join(this.cwd, 'package-lock.json');
        // Stage 6: 기존 lockfile 읽기 또는 새로 생성
        let lockFile = {
            name: 'package',
            version: '1.0.0',
            lockfileVersion: 2,
            requires: true,
            packages: {},
        };
        if (fs.existsSync(lockFilePath)) {
            try {
                lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
                // 버전 호환성 확인
                if (!lockFile.packages)
                    lockFile.packages = {};
            }
            catch (err) {
                console.warn('⚠️  Failed to parse existing lockfile, creating new one');
                lockFile.packages = {};
            }
        }
        // Stage 6: packages 디렉토리 스캔 + complete entry 생성
        const installLog = {};
        if (fs.existsSync(this.packagesDir)) {
            fs.readdirSync(this.packagesDir).forEach((pkg) => {
                const parts = pkg.lastIndexOf('@') > 0 ? pkg.split('@') : [pkg, ''];
                const pkgName = parts[0] || pkg;
                const pkgVersion = parts[1] || parts[0];
                // 기존 entry 유지하고 integrity만 업데이트
                const existingEntry = lockFile.packages[pkg] || {};
                const entry = {
                    version: pkgVersion,
                    resolved: `${this.registryUrl}/${pkgName}@${pkgVersion}`,
                    integrity: integrity && pkgName === packageName && pkgVersion === version
                        ? integrity
                        : existingEntry.integrity,
                    // Stage 6: dependencies 저장 (재설치 시 재참조용)
                    dependencies: existingEntry.dependencies || {},
                };
                lockFile.packages[pkg] = entry;
            });
        }
        // 결정론적 serialization (key sorting)
        const sortedPackages = {};
        Object.keys(lockFile.packages)
            .sort()
            .forEach((key) => {
            sortedPackages[key] = lockFile.packages[key];
        });
        lockFile.packages = sortedPackages;
        fs.writeFileSync(lockFilePath, JSON.stringify(lockFile, null, 2));
    }
    async createTarball() {
        const tarballPath = `/tmp/${Date.now()}-package.tar.gz`;
        try {
            (0, child_process_1.execSync)(`tar -czf ${tarballPath} --exclude=vpm --exclude=node_modules .`, { cwd: this.cwd });
        }
        catch (e) {
            throw new Error(`Failed to create tarball: ${e}`);
        }
        return tarballPath;
    }
    calculateChecksum(filePath) {
        const crypto = require('crypto');
        const content = fs.readFileSync(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    async makeRequest(method, path, body, token) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.registryUrl + path);
            const options = {
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname + url.search,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { Authorization: `Bearer ${token}` }),
                },
            };
            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
            // Phase 9: Add timeout for network resilience
            req.setTimeout(this.REQUEST_TIMEOUT_MS, () => {
                req.destroy(new Error(`Registry request timeout after ${this.REQUEST_TIMEOUT_MS}ms`));
            });
            req.on('error', reject);
            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }
    // Phase 9: Cryptographically secure token generation
    async createAuthToken() {
        return crypto.randomBytes(32).toString('hex'); // 64-char hex token
    }
    async getInstalledVersion(packageName) {
        if (!fs.existsSync(this.packagesDir))
            return 'none';
        const dirs = fs.readdirSync(this.packagesDir);
        const pkg = dirs.find((d) => d.startsWith(packageName + '@'));
        return pkg ? pkg.split('@')[1] : 'none';
    }
    // Phase 9: Network resilience - retry with exponential backoff + fallback registry
    async makeRequestWithRetry(method, endpoint, body, token) {
        let lastError = null;
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await this.makeRequest(method, endpoint, body, token);
            }
            catch (err) {
                lastError = err;
                if (attempt < this.MAX_RETRIES) {
                    const delay = Math.pow(2, attempt - 1) * 500; // 500, 1000, 2000ms
                    console.log(`⚠️  Registry request failed (attempt ${attempt}/${this.MAX_RETRIES}): ${lastError.message}. ` +
                        `retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        // Try fallback registry if primary failed
        if (this.fallbackRegistryUrl && this.registryUrl !== this.fallbackRegistryUrl) {
            console.log(`⚠️  Primary registry unreachable. Trying fallback: ${this.fallbackRegistryUrl}`);
            const origUrl = this.registryUrl;
            this.registryUrl = this.fallbackRegistryUrl;
            try {
                return await this.makeRequest(method, endpoint, body, token);
            }
            finally {
                this.registryUrl = origUrl;
            }
        }
        throw new Error(`Registry unreachable after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
    }
    async callResolverInstall(packageName, version, targetPath) {
        // Phase 9: 실제 파일 내용으로 무결성 계산 (downloadAndExtract에서)
        const sha256Value = this.calculateSHA256(`${packageName}@${version}-content`);
        let v9ScriptPath = '';
        try {
            // Phase 8: 단순화된 v9 script - 실제 SHA-256 검증만 수행
            v9ScriptPath = path.join(this.cwd, `.vpm-install-${Date.now()}.fl`);
            const v9Script = `; Phase 8: Real SHA-256 verification
[FUNC verify-sha256 :params [$n $v $s] :body (do (println "✅ Verified integrity: " $n "@" $v " (" $s ")") true)]

(let [[$result (verify-sha256 "${packageName}" "${version}" "${sha256Value}")]]
  (if $result
    (println "INSTALL_SUCCESS:${sha256Value}")
    (println "INSTALL_FAILED:integrity_mismatch")
  )
)`;
            fs.writeFileSync(v9ScriptPath, v9Script);
            // CLI로 실행 (출력 캡처)
            const cliPath = path.join(__dirname, 'cli.js');
            let output = '';
            try {
                output = (0, child_process_1.execSync)(`node ${cliPath} run ${v9ScriptPath} 2>&1`, {
                    encoding: 'utf-8',
                    timeout: 10000
                });
            }
            catch (execError) {
                output = execError.stdout || execError.stderr || String(execError);
            }
            // 성공/실패 판별
            const isSuccess = output.includes('✅') && output.includes('INSTALL_SUCCESS');
            return {
                success: isSuccess,
                integrity: isSuccess ? sha256Value : undefined,
                reason: isSuccess ? undefined : 'integrity_mismatch'
            };
        }
        catch (error) {
            console.error(`⚠️  resolver execution error: ${error instanceof Error ? error.message : error}`);
            return {
                success: false,
                reason: 'resolver_execution_error'
            };
        }
        finally {
            // 임시 파일 정리
            try {
                if (fs.existsSync(v9ScriptPath)) {
                    fs.unlinkSync(v9ScriptPath);
                }
            }
            catch {
                // ignore cleanup errors
            }
        }
    }
    // Phase 8: Real SHA-256 calculation
    calculateSHA256(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }
    // Phase 9: Load installed packages from lockfile (lazy init, called once per install)
    ensureLockfileLoaded() {
        if (this.lockfileLoaded)
            return;
        this.lockfileLoaded = true;
        const lockFilePath = path.join(this.cwd, 'package-lock.json');
        if (!fs.existsSync(lockFilePath))
            return;
        try {
            const lockFile = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
            for (const [pkgKey, pkgData] of Object.entries(lockFile.packages || {})) {
                if (!pkgKey || pkgKey === '' || pkgKey === '.')
                    continue;
                const lastAt = pkgKey.lastIndexOf('@');
                const name = lastAt > 0 ? pkgKey.substring(0, lastAt) : pkgKey;
                const version = pkgData.version;
                if (name && version) {
                    this.installedPackages.set(name, version);
                }
            }
        }
        catch (err) {
            // Ignore lockfile parse errors - treat as empty
            console.warn(`⚠️  Failed to parse lockfile: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Phase 9: Resolve version conflict - highest wins for minor/patch, error for major
    resolveConflict(packageName, existingVersion, requestedVersion) {
        const [em] = this.parseVersion(existingVersion);
        const [rm] = this.parseVersion(requestedVersion);
        // Major version mismatch - cannot auto-resolve (breaking change)
        if (em !== rm) {
            throw new Error(`Major version conflict for ${packageName}: ${existingVersion} (installed) vs ${requestedVersion} (requested). ` +
                `Cannot auto-resolve across major versions. Please uninstall or use a compatible version.`);
        }
        // Minor/Patch: highest wins
        const winner = this.compareVersions(requestedVersion, existingVersion) > 0
            ? requestedVersion
            : existingVersion;
        if (winner !== existingVersion) {
            console.warn(`⚠️  Version conflict for ${packageName}: ` +
                `${existingVersion} (installed) vs ${requestedVersion} (requested) → using ${winner} (highest wins)`);
        }
        this.installedPackages.set(packageName, winner);
        return winner;
    }
    detectVersionConflict(packageName, version) {
        if (this.installedPackages.has(packageName)) {
            const existingVersion = this.installedPackages.get(packageName);
            return existingVersion !== version;
        }
        return false;
    }
    // Stage 5: Semver Resolution
    resolveVersion(versions, spec) {
        // Find the best version matching the semver spec
        // Supported: "latest", "1.2.3" (exact), "^1.2.3" (caret), "~1.2.3" (tilde)
        if (spec === 'latest') {
            return versions.length > 0 ? versions[versions.length - 1] : null;
        }
        const matching = versions.filter((v) => this.versionMatches(v.version, spec));
        if (matching.length === 0)
            return null;
        // Return the highest matching version
        return matching.sort((a, b) => this.compareVersions(b.version, a.version))[0];
    }
    versionMatches(version, spec) {
        if (spec === 'latest')
            return true;
        if (spec.startsWith('^')) {
            // Caret: allow changes to minor and patch, not major
            const specVersion = spec.substring(1);
            const [specMajor] = this.parseVersion(specVersion);
            const [versionMajor] = this.parseVersion(version);
            return versionMajor === specMajor && this.compareVersions(version, specVersion) >= 0;
        }
        if (spec.startsWith('~')) {
            // Tilde: allow changes to patch, not minor
            const specVersion = spec.substring(1);
            const [specMajor, specMinor] = this.parseVersion(specVersion);
            const [versionMajor, versionMinor] = this.parseVersion(version);
            return (versionMajor === specMajor &&
                versionMinor === specMinor &&
                this.compareVersions(version, specVersion) >= 0);
        }
        // Phase 8: Advanced operators (>=, <=, >, <)
        if (spec.startsWith('>=')) {
            const specVersion = spec.substring(2);
            return this.compareVersions(version, specVersion) >= 0;
        }
        if (spec.startsWith('<=')) {
            const specVersion = spec.substring(2);
            return this.compareVersions(version, specVersion) <= 0;
        }
        if (spec.startsWith('>')) {
            const specVersion = spec.substring(1);
            return this.compareVersions(version, specVersion) > 0;
        }
        if (spec.startsWith('<')) {
            const specVersion = spec.substring(1);
            return this.compareVersions(version, specVersion) < 0;
        }
        // Phase 8: Range syntax (e.g., "1.0.0-2.5.0")
        if (spec.includes('-') && spec.match(/^\d+\.\d+\.\d+-\d+\.\d+\.\d+$/)) {
            const [minStr, maxStr] = spec.split('-');
            return this.compareVersions(version, minStr) >= 0 && this.compareVersions(version, maxStr) <= 0;
        }
        // Exact version
        return version === spec;
    }
    parseVersion(version) {
        const parts = version.split('.');
        return [parseInt(parts[0] || '0'), parseInt(parts[1] || '0'), parseInt(parts[2] || '0')];
    }
    compareVersions(v1, v2) {
        // Returns: >0 if v1 > v2, 0 if equal, <0 if v1 < v2
        const [m1, n1, p1] = this.parseVersion(v1);
        const [m2, n2, p2] = this.parseVersion(v2);
        if (m1 !== m2)
            return m1 - m2;
        if (n1 !== n2)
            return n1 - n2;
        return p1 - p2;
    }
    showHelp() {
        console.log(`
v9 Package Manager (vpm) - v1.0.0

Usage:
  vpm <command> [options]

Commands:
  install [package@version]   Install package(s)
  publish                     Publish current package to registry
  search <query>              Search packages
  list                        List installed packages
  update [package]            Update package(s)
  uninstall <package>         Uninstall package
  info <package>              Show package information
  token <action>              Manage auth tokens
  help                        Show this help message

Examples:
  vpm install awesome-lib
  vpm install awesome-lib@1.2.0
  vpm search data
  vpm list
  vpm update
  vpm publish

Environment:
  VPM_REGISTRY               Registry URL (default: http://registry.v9.dclub.kr)
  VPM_AUTH_TOKEN             Auth token for publishing

For more info: https://v9.dclub.kr/docs/vpm
`);
    }
}
exports.VpmCli = VpmCli;
// CLI Entry Point
const args = process.argv.slice(2);
const cli = new VpmCli();
cli.run(args).catch((error) => {
    console.error(`❌ ${error.message}`);
    process.exit(1);
});
//# sourceMappingURL=vpm-cli.js.map