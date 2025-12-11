import { Context } from "hono";
import { DB } from "../../../db";
import { APIResponse } from "../api-res";
import { eq, and, or } from "drizzle-orm";
import { AuthHandler } from "../authHandler";

export class TaskInfoService {

    static async getAllTasks(c: Context, asAdmin = false) {
        if (!asAdmin) {

            // @ts-ignore
            const authContext = c.get("authContext") as AuthHandler.AuthContext;

            const tasks = await DB.instance().select().from(DB.Schema.scheduled_tasks).where(
                eq(DB.Schema.scheduled_tasks.created_by_user_id, authContext.user_id)
            );

            return APIResponse.success(c, "Scheduled tasks retrieved", tasks);
        } else {

            const tasks = await DB.instance().select().from(DB.Schema.scheduled_tasks);

            return APIResponse.success(c, "Scheduled tasks retrieved", tasks);
        }
    }

    static async taskMiddleware(c: Context, next: () => Promise<void>, taskID: number, asAdmin = false) {

        let taskData: DB.Models.ScheduledTask | undefined;

        if (!asAdmin) {
            // @ts-ignore
            const authContext = c.get("authContext") as AuthHandler.AuthContext;

            taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(and(
                eq(DB.Schema.scheduled_tasks.id, taskID),
                eq(DB.Schema.scheduled_tasks.created_by_user_id, authContext.user_id)
            )).get();
        } else {
            taskData = DB.instance().select().from(DB.Schema.scheduled_tasks).where(
                eq(DB.Schema.scheduled_tasks.id, taskID)
            ).get();
        }

        if (!taskData) {
            return APIResponse.notFound(c, "Task with specified ID not found");
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

}
