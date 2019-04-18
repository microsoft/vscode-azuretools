/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StringDictionary } from 'azure-arm-website/lib/models';
import * as azureStorage from "azure-storage";
import * as retry from 'p-retry';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { delay } from '../utils/delay';
import { formatDeployLog } from './formatDeployLog';

/**
 * Method of deployment that is only intended to be used for Linux Consumption Function apps because it doesn't support kudu pushDeployment
 * To deploy with Run from Package on a Windows plan, create the app setting "WEBSITE_RUN_FROM_PACKAGE" and set it to "1".
 * Then deploy via "zipdeploy" as usual.
 */
export async function deployToStorageAccount(client: SiteClient, zipFilePath: string): Promise<void> {
    const blobName: string = azureStorage.date.secondsFromNow(0).toISOString().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s/g, '');

    const blobService: azureStorage.BlobService = await createBlobService(client);
    ext.outputChannel.appendLine(formatDeployLog(client, localize('creatingBlob', 'Uploading zip package to storage container...')));
    const blobUrl: string = await createBlobFromZip(blobService, zipFilePath, blobName);
    const appSettings: StringDictionary = await client.listApplicationSettings();
    // tslint:disable-next-line:strict-boolean-expressions
    appSettings.properties = appSettings.properties || {};
    delete appSettings.properties.WEBSITE_RUN_FROM_ZIP; // delete old app setting name if it exists
    appSettings.properties.WEBSITE_RUN_FROM_PACKAGE = blobUrl;
    await client.updateApplicationSettings(appSettings);

    // Per functions team a short delay is necessary before syncing triggers for two reasons:
    // (1) The call will definitely fail. (2) It will spin up a container unnecessarily in some cases.
    await delay(5000);

    // This can often fail with error "ServiceUnavailable", so we will retry with exponential backoff
    // Retry at most 5 times, with initial spacing of 5 seconds and total max time of about 3 minutes
    const retries: number = 5;
    await retry(
        async (currentAttempt: number) => {
            const message: string = currentAttempt === 1 ?
                localize('syncingTriggers', 'Syncing triggers...') :
                localize('syncingTriggersAttempt', 'Syncing triggers (Attempt {0}/{1})...', currentAttempt, retries + 1);
            ext.outputChannel.appendLine(formatDeployLog(client, message));
            await client.syncFunctionTriggers();
        },
        { retries, minTimeout: 5 * 1000 }
    );
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

async function createBlobFromZip(blobService: azureStorage.BlobService, zipFilePath: string, blobName: string): Promise<string> {
    const containerName: string = 'azureappservice-run-from-package';
    await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        blobService.createContainerIfNotExists(containerName, (err: Error) => {
            if (err !== null) {
                reject(err);
            } else {
                resolve();
            }
        });
    });

    await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        blobService.createBlockBlobFromLocalFile(containerName, blobName, zipFilePath, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
            if (error !== null) {
                reject(error);

            } else {
                resolve();
            }
        });
    });
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
