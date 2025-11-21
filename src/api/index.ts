import { Elysia } from 'elysia'
import { openapi as openapi_plugin } from '@elysiajs/openapi'

const routes = {
    user: await import('./modules/user'),
    auth: await import('./modules/auth'),
}

export const API_SERVER = new Elysia()
    .use(openapi_plugin())