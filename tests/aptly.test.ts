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

});