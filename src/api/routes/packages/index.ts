import { Hono } from "hono";
import { PackageModel } from './model'
import { validator as zValidator } from "hono-openapi";
import { DB } from "../../../db";
import { eq } from "drizzle-orm";
import { APIResponse } from "../../utils/api-res";
import { APIResponseSpec, APIRouteSpec } from "../../utils/specHelpers";

export const router = new Hono().basePath('/packages');

