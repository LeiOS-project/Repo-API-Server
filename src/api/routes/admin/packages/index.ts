import { Hono } from "hono";
import { validator as zValidator } from "hono-openapi";
import { z } from "zod";
import { APIResponseSpec, APIRouteSpec } from "../../../utils/specHelpers";
import { DOCS_TAGS } from "../../../docs";
import { PackageModel } from "../../../utils/shared-models/package";
import { PackagesService } from "../../../utils/services/packages";
import { router as releasesRouter } from "./releases";
import { router as stableRequestsRouter } from "./stable-promotion-requests";

export const router = new Hono().basePath('/packages');

router.get('/',

    APIRouteSpec.authenticated({
        summary: "List packages",
        description: "Retrieve a list of all packages.",
        tags: [DOCS_TAGS.ADMIN_API.PACKAGES],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success("Packages retrieved successfully", PackageModel.GetAll.Response)
        )
    }),

    async (c) => {
        return await PackagesService.getAllPackages(c, true);
    }
);

router.post('/',

    APIRouteSpec.authenticated({
        summary: "Create a new package",
        description: "Create a new package under the authenticated developer's account.",
        tags: [DOCS_TAGS.ADMIN_API.PACKAGES],

        responses: APIResponseSpec.describeWithWrongInputs(
            APIResponseSpec.created("Package created successfully", PackageModel.CreatePackageAsAdmin.Response),
            APIResponseSpec.badRequest("Owner user ID does not correspond to a developer account"),
            APIResponseSpec.conflict("Package with this name already exists")
        )
    }),

    zValidator("json", PackageModel.CreatePackageAsAdmin.Body),

    async (c) => {
        const packageData = c.req.valid("json");

        return await PackagesService.createPackage(c, packageData, true);
    }
);

router.use('/:packageID/*',

    zValidator("param", z.object({
        packageID: z.coerce.number().int().positive()
    })),

    async (c, next) => {
        // @ts-ignore
        const { packageID } = c.req.valid("param") as { packageID: number };

        return await PackagesService.packageMiddleware(c, next, packageID, true);
    }
);

router.get('/:packageID',

    APIRouteSpec.authenticated({
        summary: "Get package details",
        description: "Retrieve details of a specific package.",
        tags: [DOCS_TAGS.ADMIN_API.PACKAGES],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.success("Package retrieved successfully", PackageModel.GetPackageById.Response),
            APIResponseSpec.notFound("Package with specified ID not found")
        )
    }),

    async (c) => {
        return await PackagesService.getPackageAfterMiddleware(c);
    }
);

router.put('/:packageID',

    APIRouteSpec.authenticated({
        summary: "Update package details",
        description: "Update details of a specific package owned by the authenticated developer.",
        tags: [DOCS_TAGS.ADMIN_API.PACKAGES],

        responses: APIResponseSpec.describeWithWrongInputs(
            APIResponseSpec.successNoData("Package updated successfully"),
            APIResponseSpec.notFound("Package with specified ID not found")
        )
    }),

    zValidator("json", PackageModel.UpdatePackage.Body),

    async (c) => {
        const updateData = c.req.valid("json");

        return await PackagesService.updatePackageAfterMiddleware(c, updateData);
    }
);

router.delete('/:packageID',

    APIRouteSpec.authenticated({
        summary: "Delete a package",
        description: "Delete a specific package owned by the authenticated developer.",
        tags: [DOCS_TAGS.ADMIN_API.PACKAGES],

        responses: APIResponseSpec.describeBasic(
            APIResponseSpec.successNoData("Package deleted successfully"),
            APIResponseSpec.notFound("Package with specified ID not found")
        )
    }),

    async (c) => {
        return await PackagesService.deletePackageAfterMiddlewareAsAdmin(c);
    }
);

router.route('/:packageID', releasesRouter);
router.route('/:packageID', stableRequestsRouter);
