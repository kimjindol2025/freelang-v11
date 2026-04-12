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
    run(args: string[]): Promise<void>;
    private install;
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
    private callResolverInstall;
    private resolveVersion;
    private versionMatches;
    private parseVersion;
    private compareVersions;
    private showHelp;
}
export { VpmCli };
//# sourceMappingURL=vpm-cli.d.ts.map