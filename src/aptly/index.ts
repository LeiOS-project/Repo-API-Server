import { Client, createClient } from "./api-client/client";

export class AptlyAPI {

    protected static apiClient: Client;

    static async init(apiUrl: string) {

        this.apiClient = createClient({
            baseUrl: apiUrl
        });

    }

    static get client(): Client {
        if (!this.apiClient) {
            throw new Error("AptlyAPI not initialized. Call AptlyAPI.init(apiUrl) first.");
        }
        return this.apiClient;
    }

}
