/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site, StringDictionary } from "@azure/arm-appservice";
import { RequestBodyType, createHttpHeaders, createPipelineRequest } from "@azure/core-rest-pipeline";
import { BlobServiceClient } from "@azure/storage-blob";
import { AzExtPipelineResponse, AzExtRequestPrepareOptions, createGenericClient } from "@microsoft/vscode-azext-azureutils";
import { publisherName } from "../../../constants";
import { InnerDeployContext } from "../../IDeployContext";
import { runWithZipStream } from "../../runWithZipStream";
import { DeployZipBaseExecuteStep } from "./DeployZipBaseExecuteStep";

export class DeployFlexExecuteStep extends DeployZipBaseExecuteStep {
    public async deployZip(context: InnerDeployContext): Promise<AzExtPipelineResponse | void> {
        const site = await this.getFlexSite(context, context.site.subscription.subscriptionId, context.site.resourceGroup, context.site.siteName);
        await this.tryCreateStorageContainer(context, site);
        const kuduClient = await context.site.createClient(context);

        const RemoteBuild: boolean = site.properties?.functionAppConfig?.runtime.name === 'python';
        const callback = async zipStream => {
            return await kuduClient.flexDeploy(context, () => zipStream as RequestBodyType, {
                RemoteBuild,
                Deployer: publisherName
            });
        };

        return await runWithZipStream(context, {
            fsPath: context.fsPath,
            site: context.site,
            pathFileMap: this.pathFileMap,
            callback,
            progress: this.progress
        });
    }

    // storage container is needed for flex deployment, but it is not created automatically
    private async tryCreateStorageContainer(context: InnerDeployContext, site: Site & { properties?: { functionAppConfig: FunctionAppConfig } }): Promise<void> {
        const connectionStringAppSettingName = site.properties?.functionAppConfig?.deployment.storage.authentication.storageAccountConnectionStringName as unknown as string;
        const siteClient = await context.site.createClient(context);
        const settings: StringDictionary = await siteClient.listApplicationSettings();
        const connectionString = settings.properties && settings.properties[connectionStringAppSettingName];
        if (connectionString) {
            const blobClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerName = site.properties?.functionAppConfig?.deployment.storage.value.split('/').pop();
            if (containerName) {
                const client = blobClient.getContainerClient(containerName);
                if (!await client.exists()) {
                    await blobClient.createContainer(containerName);
                }
            }
        }
    }

    private async getFlexSite(context: InnerDeployContext, subscriptionId: string, rgName: string, siteName: string): Promise<Site & { properties?: { functionAppConfig: FunctionAppConfig } }> {
        const headers = createHttpHeaders({
            'Content-Type': 'application/json',
        });

        // we need the new api-version to get the functionAppConfig
        const options: AzExtRequestPrepareOptions = {
            url: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${rgName}/providers/Microsoft.Web/sites/${siteName}?api-version=2023-12-01`,
            method: 'GET',
            headers
        };

        const client = await createGenericClient(context, context.site.subscription);
        const result = await client.sendRequest(createPipelineRequest(options)) as AzExtPipelineResponse;
        return result.parsedBody as Site & { properties?: { functionAppConfig: FunctionAppConfig } };
    }
}

// TODO: Remove when the SDK is updated with types
type FunctionAppConfig = {
    deployment: {
        storage: {
            type: string;
            value: string;
            authentication: {
                type: string;
                userAssignedIdentityResourceId: string | null;
                storageAccountConnectionStringName: string | null;
            };
        }
    },
    runtime: {
        name: string,
        version: string
    },
    scaleAndConcurrency: {
        alwaysReady: number[],
        maximumInstanceCount: number,
        instanceMemoryMB: number,
        triggers: null
    }
};
