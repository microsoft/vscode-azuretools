/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as azureStorage from "azure-storage";
import * as crypto from "crypto";
import * as fse from 'fs-extra';
import * as moment from 'moment';
import { workspace } from 'vscode';
import { IActionContext } from 'vscode-azureextensionui';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { randomUtils } from '../utils/randomUtils';

/**
 * Method of deployment that is only intended to be used for Linux Consumption Function apps because it doesn't support kudu pushDeployment
 * To deploy with Run from Package on a Windows plan, create the app setting "WEBSITE_RUN_FROM_PACKAGE" and set it to "1".
 * Then deploy via "zipdeploy" as usual.
 */
export async function deployToStorageAccount(context: IActionContext, client: SiteClient, zipFilePath: string): Promise<void> {
    const datePart: string = moment.utc(Date.now()).format('YYYYMMDDHHmmss');
    const randomPart: string = randomUtils.getRandomHexString(32);
    const blobName: string = `${datePart}-${randomPart}.zip`;

    const blobService: azureStorage.BlobService = await createBlobService(client);
    ext.outputChannel.appendLog(localize('creatingBlob', 'Uploading zip package to storage container...'), { resourceName: client.fullName });
    const blobUrl: string = await createBlobFromZip(context, blobService, zipFilePath, blobName);
    const appSettings: StringDictionary = await client.listApplicationSettings();
    // tslint:disable-next-line:strict-boolean-expressions
    appSettings.properties = appSettings.properties || {};
    delete appSettings.properties.WEBSITE_RUN_FROM_ZIP; // delete old app setting name if it exists
    appSettings.properties.WEBSITE_RUN_FROM_PACKAGE = blobUrl;
    await client.updateApplicationSettings(appSettings);
    ext.outputChannel.appendLog(localize('deploymentSuccessful', 'Deployment successful.'), { resourceName: client.fullName });
}

async function createBlobService(client: SiteClient): Promise<azureStorage.BlobService> {
    // Use same storage account as AzureWebJobsStorage for deployments
    const azureWebJobsStorageKey: string = 'AzureWebJobsStorage';
    const settings: StringDictionary = await client.listApplicationSettings();
    if (settings.properties && settings.properties[azureWebJobsStorageKey]) {
        const blobService: azureStorage.BlobService = azureStorage.createBlobService(settings.properties[azureWebJobsStorageKey]);
        // Add retry filter since deploying may be a large file which can fail if network is poor
        return blobService.withFilter(new azureStorage.ExponentialRetryPolicyFilter());
    }
    throw new Error(localize('azureWebJobsStorageKey', '"{0}" app setting is required for Run From Package deployment.', azureWebJobsStorageKey));
}

async function createBlobFromZip(context: IActionContext, blobService: azureStorage.BlobService, zipFilePath: string, blobName: string): Promise<string> {
    const localMd5Hash: string = crypto.createHash('md5').update(await fse.readFile(zipFilePath)).digest('base64');

    const containerName: string = 'function-releases';
    await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        blobService.createContainerIfNotExists(containerName, (err: Error) => {
            if (err !== null) {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    const result: azureStorage.BlobService.BlobResult = await new Promise((resolve, reject): void => {
        blobService.createBlockBlobFromLocalFile(containerName, blobName, zipFilePath, (error: Error, r: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
            if (error !== null) {
                reject(error);
            } else {
                resolve(r);
            }
        });
    });

    // don't wait
    // NOTE: the `result` from `createBlockBlobFromLocalFile` above doesn't actually have the contentLength - thus we have to make a seperate call here
    blobService.getBlobProperties(containerName, blobName, (_error: Error, r: azureStorage.BlobService.BlobResult) => {
        context.telemetry.measurements.blobSize = Number(r.contentLength);
    });

    const suppressMd5Validation: boolean | undefined = workspace.getConfiguration(ext.prefix).get('suppressMd5Validation');
    if (!suppressMd5Validation && result.contentSettings?.contentMD5 !== localMd5Hash) {
        throw new Error(localize('md5Error', "Upload failed: Integrity error: MD5 hash mismatch between the local copy and the uploaded copy."));
    }

    const sasToken: string = blobService.generateSharedAccessSignature(containerName, blobName, <azureStorage.common.SharedAccessPolicy>{
        AccessPolicy: {
            Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ,
            Start: azureStorage.date.minutesFromNow(-5),
            // for clock desync
            Expiry: azureStorage.date.daysFromNow(10 * 365),
            ResourceTypes: azureStorage.BlobUtilities.BlobContainerPublicAccessType.BLOB
        }
    });

    return blobService.getUrl(containerName, blobName, sasToken, true);
}
