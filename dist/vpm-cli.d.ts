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
declare class VpmCli {
    private registryUrl;
    private cwd;
    private vpmDir;
    private packagesDir;
    private lockfileLoaded;
    private installedPackages;
    private fallbackRegistryUrl;
    private readonly REQUEST_TIMEOUT_MS;
    private readonly MAX_RETRIES;
    private dependencyGraph;
    private signingKey;
    private cacheDir;
    private concurrency;
    run(args: string[]): Promise<void>;
    private install;
    private verify;
    private reinstall;
    private installFromLockFile;
    private publish;
    private search;
    private list;
    private update;
    private updateSinglePackage;
    private uninstall;
    private uninstallSinglePackage;
    private token;
    private info;
    private fetchPackageInfo;
    private validateRegistryResponse;
    private downloadAndExtract;
    private installDependencies;
    private updatePackageJson;
    private removeFromPackageJson;
    private updateLockFile;
    private createTarball;
    private calculateChecksum;
    private makeRequest;
    private createAuthToken;
    private getInstalledVersion;
    private makeRequestWithRetry;
    private callResolverInstall;
    private calculateSHA256;
    private ensureLockfileLoaded;
    private resolveConflict;
    private recordDependencyRequest;
    private computeSignature;
    private detectVersionConflict;
    private resolveVersion;
    private versionMatches;
    private versionMatchesAnd;
    private versionMatchesSingle;
    private parseVersion;
    private compareVersions;
    private initCacheDir;
    private isExactSpec;
    private getCachedPackage;
    private saveToCachePackage;
    private cacheCommand;
    private cacheDir_cmd;
    private cacheList;
    private cacheVerify;
    private cacheClean;
    private cachePrune;
    private installParallel;
    private collectDependencies;
    private runWithConcurrencyLimit;
    private batchUpdatePackageJson;
    private showHelp;
}
export { VpmCli };
//# sourceMappingURL=vpm-cli.d.ts.map