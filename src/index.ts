import { API } from "./api";
import { DB } from "./db";
import { ConfigHandler } from "./utils/config";
import { Logger } from "./utils/logger";

export class Main {

    static async main() {

        const config = await ConfigHandler.loadConfig();

        Logger.setLogLevel(config.LRA_LOG_LEVEL ?? "info");

        await DB.init(
            config.LRA_DB_PATH ?? "./data/db.sqlite"
        );

        await API.init();

        await API.start(
            parseInt(config.LRA_API_PORT ?? "12151"),
            config.LRA_API_HOST ?? "::"
        );

    }

}

Main.main()