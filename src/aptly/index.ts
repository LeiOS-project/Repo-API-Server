import { client } from './api-client/client.gen';
import * as apiClient from "./api-client"

export class AptlyAPI {

    private static isInitialized: boolean = false;

    static async init(apiUrl: string) {

        client.setConfig({
            baseUrl: apiUrl
        });

        this.isInitialized = true;
    }

    static getClient() {
        if (!this.isInitialized) {
            throw new Error("AptlyAPI not initialized. Call AptlyAPI.init(apiUrl) before accessing the client.");
        }
        return apiClient;
    }

}
