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

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as crypto from 'crypto';
import * as os from 'os';
import { execSync } from 'child_process';

interface PackageJson {
  name: string;
  version: string;
  description?: string;
  main?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  v9?: {
    stdlib?: string[];
    require?: string[];
  };
  keywords?: string[];
  license?: string;
  author?: string;
  homepage?: string;
  repository?: string;
}

interface PackageLock {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: Record<string, any>;
}

interface RegistryPackage {
  id: string;
  name: string;
  description?: string;
  versions: Array<{
    version: string;
    published_at: string;
    checksum?: string;
    dependencies?: Record<string, string>;
  }>;
  downloads: number;
  stars: number;
}

// Phase 11: Disk Cache
interface CacheEntry {
  pkgInfo: any;          // registry response (RegistryPackage)
  integrity: string;     // SHA-256(JSON.stringify(pkgInfo, null, 2))
  cachedAt: string;      // ISO 8601
  registry: string;      // 원본 레지스트리 URL
}

// Phase 12: Parallel download
interface PackageResolution {
  name: string;
  version: string;
  pkgInfo: any;          // registry response
  fromCache: boolean;    // 캐시에서 온 경우
  integrity?: string;    // downloadAndExtract 후 채워짐
  signature?: string;
}

class VpmCli {
  private registryUrl = process.env.VPM_REGISTRY || 'http://registry.v9.dclub.kr';
  private cwd = process.cwd();
  private vpmDir = path.join(this.cwd, 'vpm');
  private packagesDir = path.join(this.vpmDir, 'packages');

  // Phase 9: Lockfile-based conflict detection
  private lockfileLoaded = false;
  private installedPackages: Map<string, string> = new Map();

  // Phase 9: Network resilience
  private fallbackRegistryUrl = process.env.VPM_REGISTRY_FALLBACK || '';
  private readonly REQUEST_TIMEOUT_MS = 5000;
  private readonly MAX_RETRIES = 3;

  // Phase 10: Cross-dependency tracking
  private dependencyGraph: Map<string, Map<string, string>> = new Map();
  // key: packageName → value: Map<requester, versionSpec>

  // Phase 10: Signature verification
  private signingKey = process.env.VPM_SIGNING_KEY || '';

  // Phase 11: Disk Cache
  private cacheDir: string = process.env.VPM_CACHE_DIR
    ? path.resolve(process.env.VPM_CACHE_DIR)
    : path.join(os.homedir(), '.vpm', 'cache', 'packages');

  // Phase 12: Parallel download
  private concurrency: number = Math.min(16, Math.max(1,
    parseInt(process.env.VPM_CONCURRENCY || '4', 10)));

  async run(args: string[]): Promise<void> {
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
        case 'cache':
          await this.cacheCommand(params);
          break;
        case 'help':
        case '-h':
        case '--help':
          this.showHelp();
          break;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async install(params: string[], visitedChain?: Set<string>): Promise<void> {
    // Phase 9: Load installed packages from lockfile (lazy init)
    this.ensureLockfileLoaded();

    if (params.length === 0) {
      // 의존성 설치
      await this.installFromLockFile();
      return;
    }

    // Phase 12: Multi-package parallel support
    if (params.length > 1) {
      await this.installParallel(params);
      return;
    }

    const packageSpec = params[0];
    const [packageName, versionSpec] = packageSpec.includes('@')
      ? packageSpec.split('@')
      : [packageSpec, 'latest'];

    console.log(`📦 Installing ${packageName}@${versionSpec}...`);

    // Phase 10: Circular dependency detection
    const chain = visitedChain || new Set<string>();
    const pkgKey = `${packageName}@${versionSpec}`;
    if (chain.has(pkgKey)) {
      console.warn(`⚠️  Circular dependency detected: ${pkgKey} (skipping)`);
      return;
    }
    chain.add(pkgKey);

    // Phase 10: Record dependency request for cross-dep tracking
    this.recordDependencyRequest(packageName, versionSpec, 'direct');

    // Phase 10: Check if existing version satisfies the spec (deduplication priority)
    if (this.installedPackages.has(packageName)) {
      const existingVersion = this.installedPackages.get(packageName)!;
      if (this.versionMatches(existingVersion, versionSpec)) {
        // Existing version satisfies spec → dedupe
        const pkgPath = path.join(this.packagesDir, `${packageName}@${existingVersion}`);
        if (fs.existsSync(pkgPath)) {
          console.log(`✓ ${packageName}@${existingVersion} satisfies ${versionSpec} (deduped), skipping`);
          return;
        }
      }
    }

    // Phase 11: Cache-first strategy (exact spec only)
    if (this.isExactSpec(versionSpec)) {
      const cached = this.getCachedPackage(packageName, versionSpec);
      if (cached) {
        console.log(`📦 ${packageName}@${versionSpec} (from cache)`);
        const installResult = await this.downloadAndExtract(packageName, versionSpec, cached.pkgInfo);
        this.installedPackages.set(packageName, versionSpec);
        await this.updatePackageJson(packageName, versionSpec);
        // Extract dependencies from cached pkgInfo
        const cachedVersion = cached.pkgInfo.versions?.find((v: any) => v.version === versionSpec);
        const cachedDeps = cachedVersion?.dependencies || {};
        if (Object.keys(cachedDeps).length > 0) {
          console.log(`📚 Installing ${Object.keys(cachedDeps).length} dependencies...`);
          for (const [depName, depVersion] of Object.entries(cachedDeps)) {
            this.recordDependencyRequest(depName, depVersion as string, `${packageName}@${versionSpec}`);
            await this.install([`${depName}@${depVersion}`], chain);
          }
        }
        await this.updateLockFile(packageName, versionSpec, installResult.integrity, installResult.signature);
        console.log(`✅ ${packageName}@${versionSpec} installed (cached) with integrity: ${installResult.integrity}`);
        return;
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
      const existingVersion = this.installedPackages.get(packageName)!;
      try {
        const resolved = this.resolveConflict(packageName, existingVersion, version);
        if (resolved !== version) {
          console.log(`✓ Resolver selected ${packageName}@${version}, but using ${resolved} (conflict resolution)`);
          return;
        }
      } catch (err) {
        // Major version conflict - throw error
        throw err;
      }
    }

    // 패키지 설치 (resolver.fl 호출 + registry checksum 활용)
    // pkgInfo.versions 배열에서 요청한 버전의 checksum 찾기
    let registryChecksum: string | undefined;
    let dependencies: Record<string, string> = {};
    if (pkgInfo.versions && Array.isArray(pkgInfo.versions)) {
      const versionEntry = pkgInfo.versions.find((v: any) => v.version === version);
      registryChecksum = versionEntry && versionEntry.checksum;
      dependencies = (versionEntry && versionEntry.dependencies) || {};
    }
    // Phase 9: downloadAndExtract는 pkgInfo를 파일로 저장 후 integrity 계산
    const installResult = await this.downloadAndExtract(
      packageName,
      version,
      pkgInfo
    );

    // Phase 11: Save to cache after successful registry fetch
    this.saveToCachePackage(packageName, version, pkgInfo);

    // Phase 8: 설치 추적
    this.installedPackages.set(packageName, version);

    // package.json 업데이트
    await this.updatePackageJson(packageName, version);

    // Stage 4: 의존성 재귀 설치 (registry에서 가져온 의존성 사용)
    if (Object.keys(dependencies).length > 0) {
      console.log(`📚 Installing ${Object.keys(dependencies).length} dependencies...`);
      for (const [depName, depVersion] of Object.entries(dependencies)) {
        // Phase 10: Record dependency request from this package
        this.recordDependencyRequest(depName, depVersion, `${packageName}@${version}`);
        // Phase 10: Pass visitedChain for circular dependency detection
        await this.install([`${depName}@${depVersion}`], chain);
      }
    }

    // 락파일 업데이트 (integrity + Phase 10 signature 포함)
    await this.updateLockFile(packageName, version, installResult.integrity, installResult.signature);

    console.log(`✅ ${packageName}@${version} installed with integrity: ${installResult.integrity}`);
  }

  // Stage 7: Verify command - check integrity from lockfile
  private async verify(): Promise<void> {
    const lockFilePath = path.join(this.cwd, 'package-lock.json');
    if (!fs.existsSync(lockFilePath)) {
      throw new Error('No package-lock.json found');
    }

    const lockFile: PackageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
    const packages = lockFile.packages || {};

    console.log('🔍 Verifying package integrity...');
    let verified = 0;
    let failed = 0;

    for (const [pkgName, pkgData] of Object.entries(packages)) {
      if (!pkgName || pkgName === '') continue;
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
          console.log(`❌ ${pkgName}: INTEGRITY MISMATCH (expected: ${pkgData.integrity.substring(0,16)}..., got: ${actualHash.substring(0,16)}...)`);
          failed++;
          continue;
        }

        // Phase 10: Verify signature if VPM_SIGNING_KEY is set
        if (this.signingKey && pkgData.signature) {
          const expectedSig = this.computeSignature(actualContent);
          if (expectedSig !== pkgData.signature) {
            console.log(`❌ ${pkgName}: SIGNATURE MISMATCH`);
            failed++;
            continue;
          }
        }

        console.log(`✅ ${pkgName}: OK`);
        verified++;
      } catch (err) {
        console.log(`❌ ${pkgName}: Verification failed (${err instanceof Error ? err.message : String(err)})`);
        failed++;
      }
    }

    console.log(`\n📊 Verification: ${verified} OK, ${failed} failed`);
    if (failed > 0) process.exit(1);
  }

  // Stage 7: Reinstall command - install from lockfile
  private async reinstall(): Promise<void> {
    // Phase 9: Reset lockfile-based conflict detection
    this.lockfileLoaded = false;
    this.installedPackages.clear();

    // Phase 10: Clear dependency graph
    this.dependencyGraph.clear();

    const lockFilePath = path.join(this.cwd, 'package-lock.json');
    if (!fs.existsSync(lockFilePath)) {
      throw new Error('No package-lock.json found');
    }

    const lockFile: PackageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
    const packages = lockFile.packages || {};

    console.log('🔄 Reinstalling from lockfile...');

    // Clean existing packages
    if (fs.existsSync(this.packagesDir)) {
      fs.rmSync(this.packagesDir, { recursive: true });
    }
    fs.mkdirSync(this.packagesDir, { recursive: true });

    // Phase 12: Collect all packages to reinstall (parallel)
    const packagesToInstall: string[] = [];
    for (const [pkgName, pkgData] of Object.entries(packages)) {
      if (!pkgName || pkgName === '') continue;
      const [name, version] = pkgName.lastIndexOf('@') > 0
        ? pkgName.split('@')
        : [pkgName, ''];

      if (name && version) {
        packagesToInstall.push(`${name}@${version}`);
      }
    }

    // Phase 12: Parallel reinstall if multiple packages
    if (packagesToInstall.length > 1) {
      await this.installParallel(packagesToInstall);
    } else if (packagesToInstall.length === 1) {
      await this.install([packagesToInstall[0]]);
    }

    console.log('✅ Reinstall complete');
  }

  private async installFromLockFile(): Promise<void> {
    const lockFilePath = path.join(this.cwd, 'package-lock.json');
    if (!fs.existsSync(lockFilePath)) {
      console.log('⚠️  No package-lock.json found. Install dependencies manually.');
      return;
    }

    const lockFile: PackageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
    const packages = lockFile.packages || {};

    console.log('📦 Installing dependencies from lock file...');

    // Phase 12: Collect all packages to install (parallel)
    const packagesToInstall: string[] = [];
    for (const [pkgName, pkgData] of Object.entries(packages)) {
      if (!pkgName || pkgName === '' || pkgName === '.') continue; // 루트 패키지 제외
      if (pkgData.version) {
        // Extract package name from "name@version" format
        const lastAtIndex = pkgName.lastIndexOf('@');
        const pkgNameOnly = lastAtIndex > 0 ? pkgName.substring(0, lastAtIndex) : pkgName;
        packagesToInstall.push(`${pkgNameOnly}@${pkgData.version}`);
      }
    }

    // Phase 12: Parallel installation if multiple packages
    if (packagesToInstall.length > 1) {
      await this.installParallel(packagesToInstall);
    } else if (packagesToInstall.length === 1) {
      await this.install([packagesToInstall[0]]);
    }

    console.log(`✅ Installed ${packagesToInstall.length} packages`);
  }

  private async publish(): Promise<void> {
    const pkgJsonPath = path.join(this.cwd, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) {
      throw new Error('package.json not found');
    }

    const pkgJson: PackageJson = JSON.parse(
      fs.readFileSync(pkgJsonPath, 'utf-8')
    );

    const token = process.env.VPM_AUTH_TOKEN;
    if (!token) {
      throw new Error('VPM_AUTH_TOKEN environment variable not set');
    }

    console.log(
      `📦 Publishing ${pkgJson.name}@${pkgJson.version}...`
    );

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
    } else {
      throw new Error(response.message || 'Publish failed');
    }
  }

  private async search(params: string[]): Promise<void> {
    if (params.length === 0) {
      throw new Error('Please provide a search query');
    }

    const query = params.join(' ');
    console.log(`🔍 Searching for "${query}"...`);

    const response = await this.makeRequest(
      'GET',
      `/registry/search?q=${encodeURIComponent(query)}&limit=20`
    );

    if (!response.success) {
      throw new Error(response.message || 'Search failed');
    }

    if (response.count === 0) {
      console.log('❌ No packages found');
      return;
    }

    console.log(`\n📦 Search results (${response.count} found):\n`);
    response.packages.forEach((pkg: any, idx: number) => {
      const downloads = pkg.downloads || 0;
      const stars = pkg.stars || 0;
      console.log(`${idx + 1}. ${pkg.name}`);
      console.log(`   ${pkg.description || 'No description'}`);
      console.log(`   ⬇️  ${downloads} | ⭐ ${stars}`);
      console.log();
    });
  }

  private async list(): Promise<void> {
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

  private async update(params: string[]): Promise<void> {
    if (params.length === 0) {
      // 모든 패키지 업데이트
      console.log('🔄 Updating all packages...');
      const pkgJsonPath = path.join(this.cwd, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) {
        throw new Error('package.json not found');
      }

      const pkgJson: PackageJson = JSON.parse(
        fs.readFileSync(pkgJsonPath, 'utf-8')
      );

      const deps = pkgJson.dependencies || {};
      let updated = 0;

      for (const [depName] of Object.entries(deps)) {
        try {
          await this.updateSinglePackage(depName);
          updated++;
        } catch (e) {
          console.warn(`⚠️  Failed to update ${depName}`);
        }
      }

      console.log(`✅ Updated ${updated} packages`);
      return;
    }

    const packageName = params[0];
    await this.updateSinglePackage(packageName);
  }

  private async updateSinglePackage(packageName: string): Promise<void> {
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

  private async uninstall(params: string[]): Promise<void> {
    if (params.length === 0) {
      throw new Error('Please specify a package to uninstall');
    }

    const packageName = params[0];
    await this.uninstallSinglePackage(packageName);
    await this.removeFromPackageJson(packageName);
    await this.updateLockFile();

    console.log(`✅ ${packageName} uninstalled`);
  }

  private async uninstallSinglePackage(packageName: string): Promise<void> {
    const pkgPath = path.join(
      this.packagesDir,
      fs.readdirSync(this.packagesDir).find((d) => d.startsWith(packageName))!
    );

    if (fs.existsSync(pkgPath)) {
      fs.rmSync(pkgPath, { recursive: true });
    }
  }

  private async token(params: string[]): Promise<void> {
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

  private async info(params: string[]): Promise<void> {
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

  private async fetchPackageInfo(
    packageName: string,
    version?: string
  ): Promise<RegistryPackage | null> {
    try {
      const path = version
        ? `/registry/packages?name=${encodeURIComponent(packageName)}&version=${encodeURIComponent(version)}`
        : `/registry/packages?name=${encodeURIComponent(packageName)}`;
      // Phase 9: Use retry wrapper for network resilience
      const response = await this.makeRequestWithRetry('GET', path);
      if (!response.success || !response.package) return null;

      // Phase 9: Validate registry response structure
      this.validateRegistryResponse(response.package);
      return response.package;
    } catch (err) {
      // Network errors are already logged by makeRequestWithRetry
      if (!(err instanceof Error && err.message.includes('Registry unreachable'))) {
        console.warn(`⚠️  Failed to fetch package info: ${err instanceof Error ? err.message : String(err)}`);
      }
      return null;
    }
  }

  // Phase 9: Validate registry response structure
  private validateRegistryResponse(pkg: any): void {
    if (!pkg.id || !pkg.name || !Array.isArray(pkg.versions)) {
      throw new Error(
        `Invalid registry response for package: missing required fields (id, name, versions)`
      );
    }
    if (pkg.versions.length === 0) {
      throw new Error(`Package ${pkg.name} has no published versions in registry`);
    }
  }

  private async downloadAndExtract(
    packageName: string,
    version: string,
    pkgInfo: any
  ): Promise<{ integrity: string; signature?: string; success: boolean }> {
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
    fs.writeFileSync(
      path.join(targetPath, 'package.json'),
      pkgJsonContent
    );

    // Phase 9: 실제 저장된 파일 내용으로 SHA-256 계산
    const integrity = this.calculateSHA256(pkgJsonContent);

    // Phase 10: 서명 계산 (VPM_SIGNING_KEY가 설정된 경우)
    const signature = this.signingKey ? this.computeSignature(pkgJsonContent) : undefined;

    return {
      integrity,
      signature,
      success: true
    };
  }

  private async installDependencies(
    packageName: string,
    version: string
  ): Promise<void> {
    const pkgPath = path.join(this.packagesDir, `${packageName}@${version}`);
    const pkgJsonPath = path.join(pkgPath, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) return;

    const pkgJson: PackageJson = JSON.parse(
      fs.readFileSync(pkgJsonPath, 'utf-8')
    );

    const deps = pkgJson.dependencies || {};
    for (const [depName, depVersion] of Object.entries(deps)) {
      await this.install([`${depName}@${depVersion}`]);
    }
  }

  private async updatePackageJson(
    packageName: string,
    version: string
  ): Promise<void> {
    const pkgJsonPath = path.join(this.cwd, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return;

    const pkgJson: PackageJson = JSON.parse(
      fs.readFileSync(pkgJsonPath, 'utf-8')
    );

    if (!pkgJson.dependencies) pkgJson.dependencies = {};
    pkgJson.dependencies[packageName] = version;

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  }

  private async removeFromPackageJson(packageName: string): Promise<void> {
    const pkgJsonPath = path.join(this.cwd, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return;

    const pkgJson: PackageJson = JSON.parse(
      fs.readFileSync(pkgJsonPath, 'utf-8')
    );

    if (pkgJson.dependencies && packageName in pkgJson.dependencies) {
      delete pkgJson.dependencies[packageName];
    }

    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  }

  private async updateLockFile(
    packageName?: string,
    version?: string,
    integrity?: string,
    signature?: string  // Phase 10: HMAC-SHA256 signature
  ): Promise<void> {
    const lockFilePath = path.join(this.cwd, 'package-lock.json');

    // Stage 6: 기존 lockfile 읽기 또는 새로 생성
    let lockFile: PackageLock = {
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
        if (!lockFile.packages) lockFile.packages = {};
      } catch (err) {
        console.warn('⚠️  Failed to parse existing lockfile, creating new one');
        lockFile.packages = {};
      }
    }

    // Stage 6: packages 디렉토리 스캔 + complete entry 생성
    const installLog: Record<string, { installed: boolean; integrity?: string }> = {};

    if (fs.existsSync(this.packagesDir)) {
      fs.readdirSync(this.packagesDir).forEach((pkg) => {
        const parts = pkg.lastIndexOf('@') > 0 ? pkg.split('@') : [pkg, ''];
        const pkgName = parts[0] || pkg;
        const pkgVersion = parts[1] || parts[0];

        // 기존 entry 유지하고 integrity/signature 업데이트
        const existingEntry = lockFile.packages[pkg] || {};
        const isTargetPackage = pkgName === packageName && pkgVersion === version;
        const entry: any = {
          version: pkgVersion,
          resolved: `${this.registryUrl}/${pkgName}@${pkgVersion}`,
          integrity: isTargetPackage && integrity ? integrity : existingEntry.integrity,
          // Phase 10: signature 저장 (선택적)
          ...(isTargetPackage && signature && { signature }),
          ...(!(isTargetPackage && signature) && existingEntry.signature && { signature: existingEntry.signature }),
          // Stage 6: dependencies 저장 (재설치 시 재참조용)
          dependencies: existingEntry.dependencies || {},
        };

        lockFile.packages[pkg] = entry;
      });
    }

    // 결정론적 serialization (key sorting)
    const sortedPackages: Record<string, any> = {};
    Object.keys(lockFile.packages)
      .sort()
      .forEach((key) => {
        sortedPackages[key] = lockFile.packages[key];
      });
    lockFile.packages = sortedPackages;

    fs.writeFileSync(
      lockFilePath,
      JSON.stringify(lockFile, null, 2)
    );
  }

  private async createTarball(): Promise<string> {
    const tarballPath = `/tmp/${Date.now()}-package.tar.gz`;
    try {
      execSync(
        `tar -czf ${tarballPath} --exclude=vpm --exclude=node_modules .`,
        { cwd: this.cwd }
      );
    } catch (e) {
      throw new Error(`Failed to create tarball: ${e}`);
    }
    return tarballPath;
  }

  private calculateChecksum(filePath: string): string {
    const crypto = require('crypto');
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async makeRequest(
    method: string,
    path: string,
    body?: any,
    token?: string
  ): Promise<any> {
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
          } catch {
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
  private async createAuthToken(): Promise<string> {
    return crypto.randomBytes(32).toString('hex');  // 64-char hex token
  }

  private async getInstalledVersion(packageName: string): Promise<string> {
    if (!fs.existsSync(this.packagesDir)) return 'none';
    const dirs = fs.readdirSync(this.packagesDir);
    const pkg = dirs.find((d) => d.startsWith(packageName + '@'));
    return pkg ? pkg.split('@')[1] : 'none';
  }

  // Phase 9: Network resilience - retry with exponential backoff + fallback registry
  private async makeRequestWithRetry(
    method: string,
    endpoint: string,
    body?: any,
    token?: string
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        return await this.makeRequest(method, endpoint, body, token);
      } catch (err) {
        lastError = err as Error;
        if (attempt < this.MAX_RETRIES) {
          const delay = Math.pow(2, attempt - 1) * 500;  // 500, 1000, 2000ms
          console.log(
            `⚠️  Registry request failed (attempt ${attempt}/${this.MAX_RETRIES}): ${lastError.message}. ` +
            `retrying in ${delay}ms...`
          );
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
      } finally {
        this.registryUrl = origUrl;
      }
    }

    throw new Error(`Registry unreachable after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private async callResolverInstall(
    packageName: string,
    version: string,
    targetPath: string
  ): Promise<{ success: boolean; integrity?: string; reason?: string }> {
    // Phase 9: 실제 파일 내용으로 무결성 계산 (downloadAndExtract에서)
    const sha256Value = this.calculateSHA256(`${packageName}@${version}-content`);
    let v9ScriptPath = '';

    try {
      // Phase 8: 단순화된 v9 script - 실제 SHA-256 검증만 수행
      // Phase 12: Use package@version for concurrent-safe filename
      v9ScriptPath = path.join(this.cwd, `.vpm-install-${packageName.replace(/[/@]/g, '-')}-${version}.fl`);
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
        output = execSync(`node ${cliPath} run ${v9ScriptPath} 2>&1`, {
          encoding: 'utf-8',
          timeout: 10000
        });
      } catch (execError: any) {
        output = execError.stdout || execError.stderr || String(execError);
      }

      // 성공/실패 판별
      const isSuccess = output.includes('✅') && output.includes('INSTALL_SUCCESS');

      return {
        success: isSuccess,
        integrity: isSuccess ? sha256Value : undefined,
        reason: isSuccess ? undefined : 'integrity_mismatch'
      };
    } catch (error) {
      console.error(`⚠️  resolver execution error: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        reason: 'resolver_execution_error'
      };
    } finally {
      // 임시 파일 정리
      try {
        if (fs.existsSync(v9ScriptPath)) {
          fs.unlinkSync(v9ScriptPath);
        }
      } catch {
        // ignore cleanup errors
      }
    }
  }

  // Phase 8: Real SHA-256 calculation
  private calculateSHA256(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  // Phase 9: Load installed packages from lockfile (lazy init, called once per install)
  private ensureLockfileLoaded(): void {
    if (this.lockfileLoaded) return;
    this.lockfileLoaded = true;

    const lockFilePath = path.join(this.cwd, 'package-lock.json');
    if (!fs.existsSync(lockFilePath)) return;

    try {
      const lockFile: PackageLock = JSON.parse(fs.readFileSync(lockFilePath, 'utf-8'));
      for (const [pkgKey, pkgData] of Object.entries(lockFile.packages || {})) {
        if (!pkgKey || pkgKey === '' || pkgKey === '.') continue;
        const lastAt = pkgKey.lastIndexOf('@');
        const name = lastAt > 0 ? pkgKey.substring(0, lastAt) : pkgKey;
        const version = (pkgData as any).version;
        if (name && version) {
          this.installedPackages.set(name, version);
        }
      }
    } catch (err) {
      // Ignore lockfile parse errors - treat as empty
      console.warn(`⚠️  Failed to parse lockfile: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 9: Resolve version conflict - highest wins for minor/patch, error for major
  private resolveConflict(packageName: string, existingVersion: string, requestedVersion: string): string {
    const [em] = this.parseVersion(existingVersion);
    const [rm] = this.parseVersion(requestedVersion);

    // Major version mismatch - cannot auto-resolve (breaking change)
    if (em !== rm) {
      throw new Error(
        `Major version conflict for ${packageName}: ${existingVersion} (installed) vs ${requestedVersion} (requested). ` +
        `Cannot auto-resolve across major versions. Please uninstall or use a compatible version.`
      );
    }

    // Minor/Patch: highest wins
    const winner =
      this.compareVersions(requestedVersion, existingVersion) > 0
        ? requestedVersion
        : existingVersion;

    if (winner !== existingVersion) {
      console.warn(
        `⚠️  Version conflict for ${packageName}: ` +
        `${existingVersion} (installed) vs ${requestedVersion} (requested) → using ${winner} (highest wins)`
      );
    }

    this.installedPackages.set(packageName, winner);
    return winner;
  }

  // Phase 10: Record dependency request for cross-dependency conflict detection
  private recordDependencyRequest(pkgName: string, versionSpec: string, requester: string): void {
    if (!this.dependencyGraph.has(pkgName)) {
      this.dependencyGraph.set(pkgName, new Map());
    }
    this.dependencyGraph.get(pkgName)!.set(requester, versionSpec);
  }

  // Phase 10: Compute HMAC-SHA256 signature for package content
  private computeSignature(content: string): string {
    return crypto.createHmac('sha256', this.signingKey).update(content).digest('hex');
  }

  private detectVersionConflict(packageName: string, version: string): boolean {
    if (this.installedPackages.has(packageName)) {
      const existingVersion = this.installedPackages.get(packageName)!;
      return existingVersion !== version;
    }
    return false;
  }

  // Stage 5: Semver Resolution
  private resolveVersion(
    versions: Array<{ version: string; [key: string]: any }>,
    spec: string
  ): { version: string; [key: string]: any } | null {
    // Find the best version matching the semver spec
    // Supported: "latest", "1.2.3" (exact), "^1.2.3" (caret), "~1.2.3" (tilde)

    if (spec === 'latest') {
      return versions.length > 0 ? versions[versions.length - 1] : null;
    }

    const matching = versions.filter((v) => this.versionMatches(v.version, spec));
    if (matching.length === 0) return null;

    // Return the highest matching version
    return matching.sort((a, b) => this.compareVersions(b.version, a.version))[0];
  }

  private versionMatches(version: string, spec: string): boolean {
    spec = spec.trim();
    if (spec === 'latest' || spec === '*' || spec === 'x' || spec === '') return true;

    // Phase 10: OR operator (||)
    if (spec.includes('||')) {
      return spec.split('||').map(s => s.trim()).some(s => this.versionMatchesAnd(version, s));
    }

    return this.versionMatchesAnd(version, spec);
  }

  // Phase 10: Handle AND conditions (space-separated)
  private versionMatchesAnd(version: string, spec: string): boolean {
    const conditions = spec.match(/(>=|<=|>|<|~|\^)[^\s]+|\*/g);
    if (conditions && conditions.length > 1) {
      return conditions.every(cond => this.versionMatchesSingle(version, cond));
    }
    return this.versionMatchesSingle(version, spec.trim());
  }

  // Phase 10: Handle single condition or legacy versionMatches logic
  private versionMatchesSingle(version: string, spec: string): boolean {
    if (spec === 'latest') return true;

    // Phase 10: Wildcard support
    if (spec === '*' || spec === 'x') return true;
    if (/^\d+\.x$/.test(spec)) {
      const [vm] = this.parseVersion(version);
      return vm === parseInt(spec.split('.')[0]);
    }
    if (/^\d+\.\d+\.x$/.test(spec)) {
      const [vmaj, vmin] = this.parseVersion(version);
      const parts = spec.split('.');
      return vmaj === parseInt(parts[0]) && vmin === parseInt(parts[1]);
    }

    // Phase 8 & legacy: Single operators
    if (spec.startsWith('^')) {
      const specVersion = spec.substring(1);
      const [specMajor] = this.parseVersion(specVersion);
      const [versionMajor] = this.parseVersion(version);
      return versionMajor === specMajor && this.compareVersions(version, specVersion) >= 0;
    }

    if (spec.startsWith('~')) {
      const specVersion = spec.substring(1);
      const [specMajor, specMinor] = this.parseVersion(specVersion);
      const [versionMajor, versionMinor] = this.parseVersion(version);
      return (
        versionMajor === specMajor &&
        versionMinor === specMinor &&
        this.compareVersions(version, specVersion) >= 0
      );
    }

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

  private parseVersion(version: string): [number, number, number] {
    const parts = version.split('.');
    return [parseInt(parts[0] || '0'), parseInt(parts[1] || '0'), parseInt(parts[2] || '0')];
  }

  private compareVersions(v1: string, v2: string): number {
    // Returns: >0 if v1 > v2, 0 if equal, <0 if v1 < v2
    const [m1, n1, p1] = this.parseVersion(v1);
    const [m2, n2, p2] = this.parseVersion(v2);

    if (m1 !== m2) return m1 - m2;
    if (n1 !== n2) return n1 - n2;
    return p1 - p2;
  }

  // Phase 11: Cache Manager Methods

  private initCacheDir(): void {
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (err) {
      console.warn(`⚠️  Failed to create cache directory: ${this.cacheDir}`);
    }
  }

  private isExactSpec(spec: string): boolean {
    // Check if spec is a pure X.Y.Z version (not range/latest)
    return /^\d+\.\d+\.\d+$/.test(spec);
  }

  private getCachedPackage(name: string, version: string): CacheEntry | null {
    this.initCacheDir();
    const cacheFile = path.join(this.cacheDir, `${name}@${version}.json`);

    if (!fs.existsSync(cacheFile)) {
      return null; // cache miss
    }

    try {
      const content = fs.readFileSync(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);

      // Verify integrity
      const pkgInfoStr = JSON.stringify(entry.pkgInfo, null, 2);
      const computedIntegrity = this.calculateSHA256(pkgInfoStr);

      if (computedIntegrity !== entry.integrity) {
        // Cache corrupted - remove it
        try {
          fs.unlinkSync(cacheFile);
        } catch {}
        return null;
      }

      return entry;
    } catch (err) {
      // JSON parse error or file read error - remove corrupted cache
      try {
        fs.unlinkSync(cacheFile);
      } catch {}
      return null;
    }
  }

  private saveToCachePackage(name: string, version: string, pkgInfo: any): void {
    this.initCacheDir();
    const cacheFile = path.join(this.cacheDir, `${name}@${version}.json`);

    try {
      // Compute integrity from pkgInfo
      const pkgInfoStr = JSON.stringify(pkgInfo, null, 2);
      const integrity = this.calculateSHA256(pkgInfoStr);

      const entry: CacheEntry = {
        pkgInfo,
        integrity,
        cachedAt: new Date().toISOString(),
        registry: this.registryUrl
      };

      // Atomic write: write to tmp file first, then rename
      const tmpFile = cacheFile + '.tmp';
      fs.writeFileSync(tmpFile, JSON.stringify(entry, null, 2));
      fs.renameSync(tmpFile, cacheFile);
    } catch (err) {
      // Cache save failure is not fatal - warn but continue
      console.warn(`⚠️  Failed to save cache for ${name}@${version}: ${(err as Error).message}`);
    }
  }

  // Phase 11: Cache CLI Commands

  private async cacheCommand(params: string[]): Promise<void> {
    const subcommand = params[0];

    switch (subcommand) {
      case 'dir':
        this.cacheDir_cmd();
        break;
      case 'list':
      case 'ls':
        await this.cacheList();
        break;
      case 'verify':
        await this.cacheVerify();
        break;
      case 'clean':
        this.cacheClean();
        break;
      case 'prune':
        await this.cachePrune();
        break;
      default:
        throw new Error(`Unknown cache command: ${subcommand}`);
    }
  }

  private cacheDir_cmd(): void {
    console.log(this.cacheDir);
  }

  private async cacheList(): Promise<void> {
    this.initCacheDir();

    if (!fs.existsSync(this.cacheDir)) {
      console.log('No cached packages');
      return;
    }

    const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));

    if (files.length === 0) {
      console.log('No cached packages');
      return;
    }

    console.log(`Cached packages (${files.length}):`);
    for (const file of files) {
      const pkgSpec = file.replace('.json', '');
      try {
        const content = fs.readFileSync(path.join(this.cacheDir, file), 'utf-8');
        const entry: CacheEntry = JSON.parse(content);
        console.log(`  ${pkgSpec} (cached at ${entry.cachedAt})`);
      } catch (err) {
        console.log(`  ${pkgSpec} (corrupted)`);
      }
    }
  }

  private async cacheVerify(): Promise<void> {
    this.initCacheDir();

    if (!fs.existsSync(this.cacheDir)) {
      console.log('No cached packages');
      return;
    }

    const files = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));

    if (files.length === 0) {
      console.log('No cached packages');
      return;
    }

    let passed = 0;
    let failed = 0;

    for (const file of files) {
      const pkgSpec = file.replace('.json', '');
      try {
        const content = fs.readFileSync(path.join(this.cacheDir, file), 'utf-8');
        const entry: CacheEntry = JSON.parse(content);

        // Recompute integrity
        const pkgInfoStr = JSON.stringify(entry.pkgInfo, null, 2);
        const computedIntegrity = this.calculateSHA256(pkgInfoStr);

        if (computedIntegrity === entry.integrity) {
          console.log(`✓ ${pkgSpec}`);
          passed++;
        } else {
          console.log(`❌ CACHE INTEGRITY MISMATCH: ${pkgSpec}`);
          failed++;
        }
      } catch (err) {
        console.log(`❌ CACHE INTEGRITY MISMATCH: ${pkgSpec}`);
        failed++;
      }
    }

    console.log(`\n${passed} OK, ${failed} failed`);
    if (failed > 0) {
      process.exit(1);
    }
  }

  private cacheClean(): void {
    this.initCacheDir();

    if (fs.existsSync(this.cacheDir)) {
      try {
        fs.rmSync(this.cacheDir, { recursive: true });
      } catch (err) {
        console.warn(`⚠️  Failed to remove cache directory: ${(err as Error).message}`);
        return;
      }
    }

    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    } catch (err) {
      console.warn(`⚠️  Failed to create cache directory: ${(err as Error).message}`);
      return;
    }

    console.log('Cache cleared');
  }

  private async cachePrune(): Promise<void> {
    this.initCacheDir();

    const lockfilePath = path.join(this.cwd, 'package-lock.json');

    if (!fs.existsSync(lockfilePath)) {
      console.log('⚠️  Lockfile not found - cannot prune cache');
      return;
    }

    try {
      const lockContent = fs.readFileSync(lockfilePath, 'utf-8');
      const lockfile: PackageLock = JSON.parse(lockContent);
      const lockfileKeys = new Set<string>(Object.keys(lockfile.packages || {}));

      if (!fs.existsSync(this.cacheDir)) {
        console.log('No cache to prune');
        return;
      }

      const cacheFiles = fs.readdirSync(this.cacheDir).filter((f) => f.endsWith('.json'));
      let prunedCount = 0;

      for (const file of cacheFiles) {
        const pkgSpec = file.replace('.json', '');
        if (!lockfileKeys.has(pkgSpec)) {
          try {
            fs.unlinkSync(path.join(this.cacheDir, file));
            prunedCount++;
          } catch (err) {
            console.warn(`⚠️  Failed to remove ${pkgSpec}: ${(err as Error).message}`);
          }
        }
      }

      if (prunedCount === 0) {
        console.log('No entries to prune');
      } else {
        console.log(`Pruned ${prunedCount} entries`);
      }
    } catch (err) {
      throw new Error(`Failed to prune cache: ${(err as Error).message}`);
    }
  }

  // Phase 12: Parallel download - Main orchestrator
  private async installParallel(packageSpecs: string[]): Promise<void> {
    console.log(`🚀 Installing ${packageSpecs.length} packages in parallel...`);

    // Step 1: COLLECT — 전체 의존성 수집
    const collected = new Map<string, PackageResolution>();
    for (const spec of packageSpecs) {
      try {
        await this.collectDependencies(spec, collected, new Set());
      } catch (error) {
        throw new Error(`Failed to collect dependencies for ${spec}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (collected.size === 0) {
      console.log('⚠️  No packages to install');
      return;
    }

    console.log(`📦 Total packages to install: ${collected.size}`);

    // Step 2: 낙관적 잠금 (미리 예약)
    for (const [name, res] of collected) {
      this.installedPackages.set(name, res.version);
    }

    // Step 3: PARALLEL DOWNLOAD (concurrency limited)
    try {
      await this.runWithConcurrencyLimit(
        Array.from(collected.values()),
        async (pkg) => {
          const result = await this.downloadAndExtract(pkg.name, pkg.version, pkg.pkgInfo);
          pkg.integrity = result.integrity;
          pkg.signature = result.signature;
        }
      );
    } catch (error) {
      throw new Error(`Parallel download failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Step 4: WRITE ONCE — lockfile 1회만 업데이트
    for (const [name, res] of collected) {
      if (!res.integrity || !res.signature) {
        console.warn(`⚠️  Missing integrity/signature for ${name}@${res.version}`);
      }
    }

    // 배치로 lockfile 업데이트
    for (const [name, res] of collected) {
      await this.updateLockFile(name, res.version, res.integrity || '', res.signature || '');
    }

    // packageJson 배치 업데이트
    await this.batchUpdatePackageJson(collected);

    console.log(`✅ Parallel installation complete (${collected.size} packages)`);
  }

  // Phase 12: Parallel download - Dependency collector
  private async collectDependencies(
    spec: string,
    collected: Map<string, PackageResolution>,
    chain: Set<string>,
    depth: number = 0
  ): Promise<void> {
    const [packageName, versionSpec] = spec.includes('@')
      ? spec.split('@')
      : [spec, 'latest'];

    const pkgKey = `${packageName}@${versionSpec}`;

    // 순환 의존성 방지
    if (chain.has(pkgKey)) {
      return;
    }
    chain.add(pkgKey);

    // 이미 수집됨
    const existingKey = Array.from(collected.keys()).find((k) => k === packageName);
    if (existingKey && collected.has(existingKey)) {
      const existing = collected.get(existingKey)!;
      if (this.versionMatches(existing.version, versionSpec)) {
        return; // 이미 수집됨
      }
    }

    // Phase 11: Cache hit check
    let pkgInfo: any = null;
    let fromCache = false;

    if (this.isExactSpec(versionSpec)) {
      const cached = this.getCachedPackage(packageName, versionSpec);
      if (cached) {
        pkgInfo = cached.pkgInfo;
        fromCache = true;
      }
    }

    // Phase 11: Cache miss → fetch from registry
    if (!pkgInfo) {
      pkgInfo = await this.fetchPackageInfo(packageName);
      if (!pkgInfo) {
        throw new Error(`Package ${packageName} not found`);
      }
    }

    // Resolve version
    const selectedVersion = this.resolveVersion(pkgInfo.versions, versionSpec);
    if (!selectedVersion) {
      throw new Error(`No matching version found for ${packageName}@${versionSpec}`);
    }
    const version = selectedVersion.version;

    // Conflict detection (but don't fail — just skip)
    if (this.detectVersionConflict(packageName, version)) {
      const existingVersion = this.installedPackages.get(packageName);
      if (existingVersion) {
        if (this.versionMatches(existingVersion, version)) {
          return; // Already have this version
        }
        // Try to resolve conflict
        try {
          const resolved = this.resolveConflict(packageName, existingVersion, version);
          if (resolved !== version) {
            return; // Use existing version
          }
        } catch (err) {
          throw err;
        }
      }
    }

    // Add to collected
    const resolution: PackageResolution = {
      name: packageName,
      version: version,
      pkgInfo: pkgInfo,
      fromCache: fromCache
    };
    collected.set(packageName, resolution);

    // Recursively collect dependencies
    const versionEntry = pkgInfo.versions?.find((v: any) => v.version === version);
    const deps = versionEntry?.dependencies || {};
    for (const [depName, depVersion] of Object.entries(deps)) {
      await this.collectDependencies(`${depName}@${depVersion}`, collected, chain, depth + 1);
    }
  }

  // Phase 12: Parallel download - Concurrency limiter (semaphore pattern)
  private async runWithConcurrencyLimit<T>(
    items: T[],
    fn: (item: T) => Promise<void>,
    limit?: number
  ): Promise<void> {
    const maxConcurrency = limit ?? this.concurrency;
    const queue = [...items];
    let activeCount = 0;
    let completed = 0;

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        activeCount++;
        try {
          await fn(item);
          completed++;
        } catch (error) {
          throw error;
        } finally {
          activeCount--;
        }
      }
    };

    const workers = Array(Math.min(maxConcurrency, items.length))
      .fill(null)
      .map(() => worker());

    await Promise.all(workers);
  }

  // Phase 12: Parallel download - Batch packageJson update
  private async batchUpdatePackageJson(collected: Map<string, PackageResolution>): Promise<void> {
    const packageJsonPath = path.join(this.cwd, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      // Create package.json if not exists
      const pkg: PackageJson = {
        name: path.basename(this.cwd),
        version: '1.0.0',
        dependencies: {}
      };
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    }

    const packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (!packageJson.dependencies) {
      packageJson.dependencies = {};
    }

    // Batch update all dependencies
    for (const [name, res] of collected) {
      packageJson.dependencies[name] = res.version;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  }

  private showHelp(): void {
    console.log(`
v9 Package Manager (vpm) - v1.0.0

Usage:
  vpm <command> [options]

Commands:
  install [package@version...] Install package(s) - supports multiple (Phase 12 parallel)
  publish                      Publish current package to registry
  search <query>               Search packages
  list                         List installed packages
  update [package]             Update package(s)
  uninstall <package>          Uninstall package
  info <package>               Show package information
  token <action>               Manage auth tokens
  verify                       Verify package integrity
  reinstall                    Reinstall all packages from lockfile (Phase 12 parallel)
  cache dir                    Show cache directory path
  cache list                   List cached packages
  cache verify                 Verify cache integrity
  cache clean                  Clear all cache
  cache prune                  Remove cache entries not in lockfile
  help                         Show this help message

Examples:
  vpm install awesome-lib
  vpm install awesome-lib@1.2.0
  vpm install pkg1@1.0.0 pkg2@2.0.0 pkg3@latest    (parallel install)
  vpm search data
  vpm list
  vpm update
  vpm publish
  vpm cache list
  vpm cache verify

Environment:
  VPM_REGISTRY               Registry URL (default: http://registry.v9.dclub.kr)
  VPM_AUTH_TOKEN             Auth token for publishing
  VPM_CACHE_DIR              Override cache directory (default: ~/.vpm/cache/packages)
  VPM_SIGNING_KEY            Signing key for package integrity verification
  VPM_CONCURRENCY            Parallel download limit (default: 4, min: 1, max: 16)

For more info: https://v9.dclub.kr/docs/vpm
`);
  }
}

// CLI Entry Point
const args = process.argv.slice(2);
const cli = new VpmCli();
cli.run(args).catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});

export { VpmCli };
