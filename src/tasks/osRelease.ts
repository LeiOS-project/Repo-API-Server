import { TaskHandler } from "@cleverjs/utils";
import { DB } from "../db";
import { eq, is } from "drizzle-orm";
import { AptlyAPI } from "../aptly/api";

interface Payload {
    pkgReleasesToIncludeByID: number[];
    version: string;
}
interface StepState {
    nextPackageIndexToMove: number;
}

// export function registerOsReleaseTasks() {
//     TaskScheduler.register("os-release:create", async (payload) => {
//         const { version } = PayloadSchema.parse(payload);

//         const existing = DB.instance().select().from(DB.Schema.os_releases).where(eq(DB.Schema.os_releases.version, version)).get();
//         if (existing) {
//             throw new Error("OS release already exists");
//         }

//         // Persist new OS release marker
//         await DB.instance().insert(DB.Schema.os_releases).values({ version });

//         // TODO: hook actual repo publish/update steps here if available
//         Logger.info(`OS release ${version} recorded. Add repo publish logic here if needed.`);

//         return { version };
//     });
// }

export const OsReleaseTask = new TaskHandler.StepBasedTaskFn("os-release:create", async (payload: Payload, logger, state: StepState) => {

    state.nextPackageIndexToMove = 0;

    return { success: true };
});

OsReleaseTask.addStep("Move packages from archive to local stable repo", async (payload, logger, state, isPaused) => {

    for (; state.nextPackageIndexToMove < payload.pkgReleasesToIncludeByID.length; state.nextPackageIndexToMove++) {

        try {

            if (isPaused.valueOf()) {
                logger.info("Pausing First Long Step at index", state.nextPackageIndexToMove);
                return { success: true, paused: true };
            }

            const pkgReleaseID = payload.pkgReleasesToIncludeByID[state.nextPackageIndexToMove];
            const release = DB.instance().select().from(DB.Schema.packageReleases).where(
                eq(DB.Schema.packageReleases.id, pkgReleaseID)
            ).get();

            if (!release) {
                logger.error(`Package release with ID ${pkgReleaseID} not found, skipping.`);
                continue;
            }

            const packageName = DB.instance().select().from(DB.Schema.packages).where(
                eq(DB.Schema.packages.id, release.package_id)
            ).get()?.name;

            if (!packageName) {
                logger.error(`Package with ID ${release.package_id} not found for release ID ${pkgReleaseID}, skipping.`);
                continue;
            }

            // delete in stable for this package first but ensure we only delete for this architecture
            await AptlyAPI.Packages.deleteInRepo("leios-stable", packageName, undefined, release.architecture);
        } catch (err) {
            logger.error("Error moving package release ID", payload.pkgReleasesToIncludeByID[state.nextPackageIndexToMove], ":", err);
        }
    }

    return { success: true };

});