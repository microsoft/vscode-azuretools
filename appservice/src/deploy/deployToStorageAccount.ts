/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementModels } from '@azure/arm-appservice';
import { Environment } from '@azure/ms-rest-azure-env';
import { BlobSASPermissions, BlobServiceClient, BlockBlobClient, ContainerClient, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import * as dayjs from 'dayjs';
// eslint-disable-next-line import/no-internal-modules
import * as relativeTime from 'dayjs/plugin/relativeTime';
// eslint-disable-next-line import/no-internal-modules
import * as utc from 'dayjs/plugin/utc';
import { URL } from 'url';
import { IActionContext, parseError } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { ParsedSite } from '../SiteClient';
import { randomUtils } from '../utils/randomUtils';
import { IDeployContext } from './IDeployContext';
import { runWithZipStream } from './runWithZipStream';

dayjs.extend(relativeTime);
dayjs.extend(utc);

/**
 * Method of deployment that is only intended to be used for Linux Consumption Function apps because it doesn't support kudu pushDeployment
 * To deploy with Run from Package on a Windows plan, create the app setting "WEBSITE_RUN_FROM_PACKAGE" and set it to "1".
 * Then deploy via "zipdeploy" as usual.
 */
export async function deployToStorageAccount(context: IDeployContext, fsPath: string, site: ParsedSite): Promise<void> {
    context.telemetry.properties.useStorageAccountDeploy = 'true';

    const datePart: string = dayjs().utc().format('YYYYMMDDHHmmss');
    const randomPart: string = randomUtils.getRandomHexString(32);
    const blobName: string = `${datePart}-${randomPart}.zip`;

    const blobService: BlobServiceClient = await createBlobServiceClient(context, site);
    const blobUrl: string = await createBlobFromZip(context, fsPath, site, blobService, blobName);
    const client = await site.createClient(context);
    const appSettings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
    appSettings.properties = appSettings.properties || {};
    delete appSettings.properties.WEBSITE_RUN_FROM_ZIP; // delete old app setting name if it exists
    appSettings.properties.WEBSITE_RUN_FROM_PACKAGE = blobUrl;
    await client.updateApplicationSettings(appSettings);
    ext.outputChannel.appendLog(localize('deploymentSuccessful', 'Deployment successful.'), { resourceName: site.fullName });

    context.syncTriggersPostDeploy = true;
}

async function createBlobServiceClient(context: IActionContext, site: ParsedSite): Promise<BlobServiceClient> {
    const client = await site.createClient(context);
    // Use same storage account as AzureWebJobsStorage for deployments
    const azureWebJobsStorageKey: string = 'AzureWebJobsStorage';
    const settings: WebSiteManagementModels.StringDictionary = await client.listApplicationSettings();
    let connectionString: string | undefined = settings.properties && settings.properties[azureWebJobsStorageKey];
    if (connectionString) {
        try {
            return BlobServiceClient.fromConnectionString(connectionString);
        } catch (error) {
            // EndpointSuffix was optional in the old sdk, but is required in the new sdk
            // https://github.com/microsoft/vscode-azurefunctions/issues/2360
            const endpointSuffix: string = 'EndpointSuffix';
            const separator: string = ';';
            if (parseError(error).message.includes(endpointSuffix) && !connectionString.includes(endpointSuffix)) {
                if (!connectionString.endsWith(separator)) {
                    connectionString += separator;
                }
                connectionString += `${endpointSuffix}=${Environment.AzureCloud.storageEndpointSuffix}${separator}`;
                return BlobServiceClient.fromConnectionString(connectionString);
            } else {
                throw error;
            }
        }
    } else {
        throw new Error(localize('azureWebJobsStorageKey', '"{0}" app setting is required for Run From Package deployment.', azureWebJobsStorageKey));
    }
}

async function createBlobFromZip(context: IActionContext, fsPath: string, site: ParsedSite, blobService: BlobServiceClient, blobName: string): Promise<string> {
    const containerName: string = 'function-releases';
    const containerClient: ContainerClient = blobService.getContainerClient(containerName);
    if (!await containerClient.exists()) {
        await containerClient.create();
    }

    const blobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobName);

    await runWithZipStream(context, {
        fsPath, site, callback: async zipStream => {
            ext.outputChannel.appendLog(localize('creatingBlob', 'Uploading zip package to storage container...'), { resourceName: site.fullName });
            await blobClient.uploadStream(zipStream);
        }
    });

    // NOTE: the `result` from `uploadStream` above doesn't actually have the contentLength - thus we have to make a separate call here
    void blobClient.getProperties().then(r => {
        context.telemetry.measurements.blobSize = Number(r.contentLength);
    });

    if (blobService.credential instanceof StorageSharedKeyCredential) {
        const url: URL = new URL(blobClient.url);
        url.search = generateBlobSASQueryParameters(
            {
                containerName,
                blobName,
                permissions: BlobSASPermissions.parse('r'),
                startsOn: dayjs().utc().subtract(5, 'minute').toDate(),
                expiresOn: dayjs().utc().add(10, 'year').toDate()
            },
            blobService.credential).toString();
        return url.toString();
    } else {
        throw new Error('Internal Error: Expected credential to be of type "StorageSharedKeyCredential".');
    }
}
