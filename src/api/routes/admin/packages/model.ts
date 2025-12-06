import z from "zod";
import { PackageModel } from "../../developer/packages/model";
import { AptlyAPI } from "../../../../aptly/api";
import { StableRequestModel } from "../../shared/stableRequests";

export namespace AdminPackageModel {

    export const PackageDetails = z.object({
        package: PackageModel.GetPackageById.Response,
        releases: AptlyAPI.Packages.Models.getAllInAllReposResponse,
        stableRequests: StableRequestModel.List.Response
    });
    export type PackageDetails = z.infer<typeof PackageDetails>;

    export const ListResponse = PackageModel.GetAll.Response;
    export type ListResponse = z.infer<typeof ListResponse>;

    export const StableRequestIdParams = z.object({
        requestId: z.coerce.number().int().positive()
    });
}
