import { Context } from "hono";
import { DB } from "../../../db";
import { APIResponse } from "../api-res";
import { eq, and, or, like, desc, asc } from "drizzle-orm";
import { AuthHandler } from "../authHandler";
import { ConfigHandler } from "../../../utils/config";
import { ApiHelperModels } from "../shared-models/api-helper-models";

export class TaskInfoService {

    static async getAllTasks(c: Context, queryOpts: ApiHelperModels.ListAll.QueryWithSearch, asAdmin = false) {

        if (!asAdmin) {

            // @ts-ignore
            const authContext = c.get("authContext") as AuthHandler.AuthContext;

            const whereClause = and(
                eq(DB.Schema.scheduled_tasks.created_by_user_id, authContext.user_id),
                queryOpts.searchString
                    ? like(DB.Schema.scheduled_tasks.tag, `%${queryOpts.searchString}%`)
                    : undefined
            );

            const tasks = await DB.instance().select()
            .from(DB.Schema.scheduled_tasks)
            .where(whereClause)
            .orderBy(
                queryOpts.order === "newest" ?
                    desc(DB.Schema.stablePromotionRequests.created_at) :
                    asc(DB.Schema.stablePromotionRequests.created_at)
            )
            .limit(queryOpts.limit)
            .offset(queryOpts.offset);
            

            return APIResponse.success(c, "Scheduled tasks retrieved", tasks);
        } else {

            const tasks = await DB.instance().select().from(DB.Schema.scheduled_tasks);

            return APIResponse.success(c, "Scheduled tasks retrieved", tasks);
        }
    }

    static async taskMiddleware(c: Context, next: () => Promise<void>, taskIDorTag: number | string, asAdmin = false) {

        let taskData: DB.Models.ScheduledTask | undefined;

        if (!asAdmin) {
            // @ts-ignore
            const authContext = c.get("authContext") as AuthHandler.AuthContext;

            if (typeof taskIDorTag === "number") {
                taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(and(
                    eq(DB.Schema.scheduled_tasks.id, taskIDorTag),
                    eq(DB.Schema.scheduled_tasks.created_by_user_id, authContext.user_id)
                )).get();
            } else {
                taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(and(
                    eq(DB.Schema.scheduled_tasks.tag, taskIDorTag),
                    eq(DB.Schema.scheduled_tasks.created_by_user_id, authContext.user_id)
                )).get();
            }
        } else {
            
            if (typeof taskIDorTag === "number") {
                taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(
                    eq(DB.Schema.scheduled_tasks.id, taskIDorTag)
                ).get();
            } else {
                taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(
                    eq(DB.Schema.scheduled_tasks.tag, taskIDorTag)
                ).get();
            }
        }

        if (!taskData) {
            return APIResponse.notFound(c, "Task with specified ID or Tag not found");
        }
        // @ts-ignore
        c.set("task", taskData);

        await next();
    }

    static async getTaskAfterMiddleware(c: Context) {
        // @ts-ignore
        const taskData = c.get("task") as DB.Models.ScheduledTask;

        return APIResponse.success(c, "Task retrieved successfully", taskData);
    }

    static async getTaskLogsAfterMiddleware(c: Context) {
        // @ts-ignore
        const taskData = c.get("task") as DB.Models.ScheduledTask;

        if (!taskData.storeLogs) {
            return APIResponse.badRequest(c, "Logs are not stored for this task");
        }

        const logs = Bun.file((ConfigHandler.getConfig()?.LRA_LOG_DIR || "./data/logs") + `/tasks/task-${taskData.id}.log`);
        if (!await logs.exists()) {
            return APIResponse.notFound(c, "Log file not found for this task");
        }

        return APIResponse.success(c, "Task logs retrieved successfully", { logs: await logs.text() });
    }

}