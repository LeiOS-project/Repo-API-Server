import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { AptlyAPI, RepoUtils } from "../src/aptly";

beforeAll(async() => {
    await AptlyAPI.init({
        aptlyRoot: "./data/aptly",
        aptlyPort: 8080
    });
    await AptlyAPI.start();
});

afterAll(() => {
    AptlyAPI.aptlyProcess.kill("SIGINT");
});

describe("Aptly Package Deletion", () => {

    test("Get Package References", async () => {
        const packageRefs = await RepoUtils.getPackageRefInRepo("sample-package", "leios-stable");
        expect(packageRefs).toBeInstanceOf(Array);
    });

    test("Upload and Verify Package", async () => {

        const filePath = "./testdata/fastfetch_2.55.1leios1_amd64.deb";
        const fileData = new File([await Bun.file(filePath).arrayBuffer()], "fastfetch_2.55.1leios1_amd64.deb");

        const packageData = {
            name: "fastfetch",
            maintainerName: "Carter Li",
            maintainerEmail: "zhangsongcui@live.cn",
            version: "2.55.1",
            architecture: "amd64"
        };

        const repoName = "leios-testing";

        const uploadResult = await RepoUtils.uploadAndVerifyPackage(packageData, fileData, repoName);
        expect(uploadResult).toBe(true);

    });

});