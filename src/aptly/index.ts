import { client } from './api-client/client.gen';
import * as apiClient from "./api-client"
import { Logger } from '../utils/logger';
import { Utils } from '../utils';
import { AptlyUtils } from './utils';
import fs from 'fs';
import { dirname } from 'path';

export interface AptlyAPISettings {
    aptlyRoot: string;
    aptlyPort: number;
}

export class AptlyAPI {

    private static isInitialized: boolean = false;

    public static aptlyProcess: Bun.Subprocess<"ignore", "pipe", "pipe">;

    public static aptlyRoot: string;
    public static aptlyDataDir: string;
    public static aptlyUploadDir: string;
    public static aptlyBinaryPath: string;
    public static aptlyConfigPath: string;
    public static aptlyPort: number;

    static async init(settings: AptlyAPISettings) {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.aptlyRoot = settings.aptlyRoot;
        this.aptlyDataDir = settings.aptlyRoot + "/data";
        this.aptlyUploadDir = this.aptlyDataDir + "/upload";
        this.aptlyBinaryPath = settings.aptlyRoot + "/bin/aptly";
        this.aptlyConfigPath = settings.aptlyRoot + "/.config/aptly.conf";
        this.aptlyPort = settings.aptlyPort;

        await AptlyUtils.downloadAptlyBinaryIfNeeded(this.aptlyBinaryPath);

        await Utils.sleep(100);

        await this.setupAptlyConfig();

        await Utils.sleep(100);
    }

    static async start() {
        // Start Aptly in the background piping sdtout and stderr to Bun
        this.aptlyProcess = Bun.spawn({
            cmd: [
                this.aptlyBinaryPath,
                "-config=" + this.aptlyConfigPath,
                "api", "serve",
                "-listen=127.0.0.1:" + this.aptlyPort.toString()
            ],
            stdin: 'ignore',
            stdout: 'pipe',
            // stdout: 'ignore',
            stderr: 'pipe',
            detached: false
        });

        AptlyUtils.forwardAptlyOutput(this.aptlyProcess.stdout, (line: string) => Logger.info(`[APTLY] ${line}`));
        AptlyUtils.forwardAptlyOutput(this.aptlyProcess.stderr, (line: string) => Logger.error(`[APTLY] ${line}`));


        await Utils.sleep(1000);

        if (this.aptlyProcess.exitCode !== null) {
            throw new Error("Failed to start Aptly API server. Exit code: " + this.aptlyProcess.exitCode);
        }

        client.setConfig({
            baseUrl: `http://127.0.0.1:${this.aptlyPort}`
        });

        await this.createDefaultRepositoriesIfNeeded();
    }

    protected static async setupAptlyConfig(overrideConfig: Record<string, any> = {}) {

        try {

            const config = {
                "rootDir": this.aptlyDataDir,
                "logLevel": Logger.getLogLevel(),
                // "EnableSwaggerEndpoint": true,
                "S3PublishEndpoints": null,
                "FileSystemPublishEndpoints": null,
                "SwiftPublishEndpoints": null,
                "AzurePublishEndpoints": null,
                "packagePoolStorage": {}
            };

            await Bun.file(this.aptlyConfigPath).write(JSON.stringify({
                ...config,
                ...overrideConfig
            }));

            Logger.info(`Aptly config successfully setup`);
        } catch (error) {
            throw new Error("Failed to write Aptly config: " + error);
        }

    }

    protected static async createDefaultRepositoriesIfNeeded() {

        try {

            const existReposResponse = (await this.getClient().getApiRepos({}));

            if (!existReposResponse.data) {
                throw new Error("Failed to fetch existing repositories: " + existReposResponse.error);
            }
            const existingRepos = existReposResponse.data;

            if (!existingRepos.some(repo => repo.Name === "leios-stable")) {
                await this.getClient().postApiRepos({
                    body: {
                        Name: "leios-stable",
                        DefaultComponent: "main",
                        DefaultDistribution: "stable"
                    }
                });

                Logger.info("Repository 'leios-stable' created.");
            }

            if (!existingRepos.some(repo => repo.Name === "leios-testing")) {
                await this.getClient().postApiRepos({
                    body: {
                        Name: "leios-testing",
                        DefaultComponent: "main",
                        DefaultDistribution: "testing"
                    }
                });

                Logger.info("Repository 'leios-testing' created.");
            }

            // the archive repo is not published by default, its just to hold every package version in history
            if (!existingRepos.some(repo => repo.Name === "leios-archive")) {
                await this.getClient().postApiRepos({
                    body: {
                        Name: "leios-archive",
                        DefaultComponent: "main",
                        DefaultDistribution: "archive"
                    }
                });

                Logger.info("Repository 'leios-archive' created.");
            }

        } catch (error) {
            Logger.error("Failed to create default repositories: ", error);
            throw new Error("Failed to create default repositories: " + error);
        }

    }

    static getClient() {
        if (!this.isInitialized) {
            throw new Error("AptlyAPI not initialized. Call AptlyAPI.init before accessing the client.");
        }
        return apiClient;
    }


    static async stop(type: NodeJS.Signals) {
        if (this.aptlyProcess) {
            this.aptlyProcess.kill(type);
            Logger.info("Aptly process stopped.");
        }
    }

}

export namespace RepoUtils {

    export const DEFAULT_REPOS = ["leios-stable", "leios-testing", "leios-archive"] as const;

    export async function getPackageRefInRepo(packageName: string, repoName: string) {
        return (await AptlyAPI.getClient().getApiReposByNamePackages({
            path: {
                name: repoName
            },
            query: {
                q: `Name (${packageName})`,
                withDeps: "",
                format: "",
                maximumVersion: ""
            }
        })).data as any as string[] || [];
    }

    export async function uploadAndVerifyPackage(
        packageData: {
            name: string;
            maintainerName: string;
            maintainerEmail: string;
            version: string;
            architecture: string;
        },
        file: File,
        repoName: string,
        skipMaintainerCheck = false
    ) {
        const fullPackageVersion = AptlyUtils.buildVersionWithLeiOSSuffix(packageData.version);
        const uploadSubDir = Bun.randomUUIDv7();
        const fileName = `${packageData.name}_${fullPackageVersion}_${packageData.architecture}.deb`;
        const fullFilePath = AptlyAPI.aptlyUploadDir + "/" + uploadSubDir + "/" + fileName;
        await Bun.write(fullFilePath, await file.arrayBuffer());

        const dpkgChackResult = await Bun.$`dpkg --info ${fullFilePath}`.text();

        if (!dpkgChackResult.includes(`Version: ${fullPackageVersion}`)) {
            fs.rmSync(dirname(fullFilePath), { recursive: true, force: true });
            throw new Error("Uploaded package version mismatch.");
        }

        if (!dpkgChackResult.includes(`Architecture: ${packageData.architecture}`)) {
            fs.rmSync(dirname(fullFilePath), { recursive: true, force: true });
            throw new Error("Uploaded package architecture mismatch.");
        }

        if (!dpkgChackResult.includes(`Package: ${packageData.name}`)) {
            fs.rmSync(dirname(fullFilePath), { recursive: true, force: true });
            throw new Error("Uploaded package name mismatch.");
        }

        if (!skipMaintainerCheck && !dpkgChackResult.includes(`Maintainer: ${packageData.maintainerName} <${packageData.maintainerEmail}>`)) {
            fs.rmSync(dirname(fullFilePath), { recursive: true, force: true });
            throw new Error("Uploaded package maintainer mismatch.");
        }

        const addingResult = await AptlyAPI.getClient().postApiReposByNameFileByDirByFile({
            path: {
                name: repoName,
                dir: uploadSubDir,
                file: fileName
            }
        });

        const addedFiles = (addingResult.data as any as { "Report": { "Added": string[] } })["Report"]["Added"];

        if (addingResult.error || !addedFiles[0].includes("added")) {

            fs.rmSync(dirname(fullFilePath), { recursive: true, force: true });

            throw new Error("Failed to add package to repository: " + addingResult.error);
        }

        return true;
    }

    export async function deletePackageInRepo(packageName: string, repoName: string) {
        const refs = await getPackageRefInRepo(packageName, repoName);
        const result = await AptlyAPI.getClient().deleteApiReposByNamePackages({
            body: {
                PackageRefs: refs
            },
            path: {
                name: repoName
            }
        });
        return (result.data && !result.error) ? true : false;
    }

    export async function deletePackageInAllRepos(packageName: string) {
        for (const repo of DEFAULT_REPOS) {
            await deletePackageInRepo(packageName, repo);
        }
        return true;
    }

}