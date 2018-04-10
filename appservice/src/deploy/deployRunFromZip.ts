/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { StorageAccount, StorageAccountListKeysResult } from 'azure-arm-storage/lib/models';
import { StorageAccountListResult } from 'azure-arm-storage/lib/models';
import { StringDictionary } from 'azure-arm-website/lib/models';
import * as azureStorage from "azure-storage";
import * as vscode from 'vscode';
import { TelemetryProperties } from 'vscode-azureextensionui';
import * as FileUtilities from '../FileUtilities';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { uiUtils } from '../utils/uiUtils';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { formatDeployLog } from './formatDeployLog';

export async function deployRunFromZip(client: SiteClient, fsPath: string, outputChannel: vscode.OutputChannel, telemetryProperties?: TelemetryProperties): Promise<void> {
    // if (confirmDeployment) {
    //     const warning: string = localize('zipWarning', 'Are you sure you want to deploy to "{0}"? This will overwrite any previous deployment and cannot be undone.', client.fullName);
    //     if (await vscode.window.showWarningMessage(warning, DialogResponses.yes, DialogResponses.cancel) !== DialogResponses.yes) {
    if (telemetryProperties) {
        telemetryProperties.cancelStep = 'confirmDestructiveDeployment';
    }
    //         throw new UserCancelledError();
    //     }
    // }
    // does this count as a destructive action?
    const storageAccounts: StorageAccountListResult = await client.listStorageAccounts();
    const storageAccountQuickPicks: IQuickPickItemWithData<StorageAccount>[] = storageAccounts.map((sa: StorageAccount) => {
        return {
            label: sa.name,
            description: '',
            data: sa
        };
    });

    const storageAccount: StorageAccount = (await uiUtils.showQuickPickWithData(storageAccountQuickPicks, { placeHolder: 'Choose a storage account to host the zip file.', ignoreFocusOut: true })).data;
    let zipFilePath: string;
    let createdZip: boolean = false;
    outputChannel.show();
    if (FileUtilities.getFileExtension(fsPath) === 'zip') {
        zipFilePath = fsPath;
    } else if (await FileUtilities.isDirectory(fsPath)) {
        createdZip = true;
        outputChannel.appendLine(formatDeployLog(client, localize('zipCreate', 'Creating zip package...')));
        zipFilePath = await FileUtilities.zipDirectory(fsPath);
    } else {
        throw new Error(localize('NotAZipError', 'Path specified is not a folder or a zip file'));
    }

    try {
        const blobService: azureStorage.BlobService = await createBlobService(client, storageAccount);
        const blobUrl: string = await createBlobFromZip(blobService, zipFilePath);
        outputChannel.appendLine(formatDeployLog(client, localize('deployStart', 'Starting deployment...')));
        const WEBSITE_USE_ZIP: string = 'WEBSITE_USE_ZIP';
        const appSettings: StringDictionary = await client.listApplicationSettings();
        appSettings.properties[WEBSITE_USE_ZIP] = blobUrl;
        await client.updateApplicationSettings(appSettings);
    } catch (error) {
        // tslint:disable-next-line:no-unsafe-any
        if (error && error.response && error.response.body) {
            // Autorest doesn't support plain/text as a MIME type, so we have to get the error message from the response body ourselves
            // https://github.com/Azure/autorest/issues/1527
            // tslint:disable-next-line:no-unsafe-any
            throw new Error(error.response.body);
        } else {
            throw error;
        }
    } finally {
        if (createdZip) {
            await FileUtilities.deleteFile(zipFilePath);
        }
    }
}

function parseAzureResourceId(resourceId: string): { [key: string]: string } {
    const invalidIdErr: Error = new Error('Invalid Account ID.');
    const result: {} = {};

    if (!resourceId || resourceId.length < 2 || resourceId.charAt(0) !== '/') {
        throw invalidIdErr;
    }

    const parts: string[] = resourceId.substring(1).split('/');

    if (parts.length % 2 !== 0) {
        throw invalidIdErr;
    }

    for (let i: number = 0; i < parts.length; i += 2) {
        const key: string = parts[i];
        const value: string = parts[i + 1];

        if (key === '' || value === '') {
            throw invalidIdErr;
        }

        result[key] = value;
    }

    return result;
}

async function createBlobService(client: SiteClient, sa: StorageAccount): Promise<azureStorage.BlobService> {
    const parsedId: { [key: string]: string } = parseAzureResourceId(sa.id);
    const resourceGroups: string = 'resourceGroups';
    const saResourceGroup: string = parsedId[resourceGroups];
    const storageAccountKeys: StorageAccountListKeysResult = await client.listStorageAccountKeys(saResourceGroup, sa.name);
    return azureStorage.createBlobService(sa.name, storageAccountKeys.keys[0].value);

}

async function createBlobFromZip(blobService: azureStorage.BlobService, zipFilePath: string): Promise<string> {
    const containerName: string = 'azureappservice-run-from-zip';
    const blobName: string = azureStorage.date.secondsFromNow(0).toLocaleString().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '').replace(/\s/g, ''); // get rid of any special characters and spaces in the timestamp
    await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        blobService.createContainerIfNotExists(containerName, { publicAccessLevel: 'blob' }, (err: Error) => {
        if (err) {
            reject(err);
        } else {
            resolve();
        }
     });
    });

    await new Promise<void>((resolve: () => void, reject: (err: Error) => void): void => {
        blobService.createBlockBlobFromLocalFile(containerName, blobName, zipFilePath, (error: Error, _result: azureStorage.BlobService.BlobResult, _response: azureStorage.ServiceResponse) => {
            if (!!error) {
                // tslint:disable-next-line:no-any
                const errorAny: any = error;
                // tslint:disable-next-line:no-unsafe-any
                if (!!errorAny.code) {
                    // tslint:disable-next-line:no-unsafe-any
                    let humanReadableMessage: string = `Unable to save '${blobName}', blob service returned error code "${errorAny.code}"`;
                    // tslint:disable-next-line:no-unsafe-any
                    switch (errorAny.code) {
                        case 'ENOTFOUND':
                            humanReadableMessage +=  ' - Please check connection.';
                            break;
                        default:
                            break;
                    }
                    reject(new Error(humanReadableMessage));
                } else {
                    reject(error);
                }
            } else {
                resolve();
            }
        });
    });
    const sasToken: string = blobService.generateSharedAccessSignature(containerName, blobName, <azureStorage.common.SharedAccessPolicy>{ AccessPolicy: {
        Permissions: azureStorage.BlobUtilities.SharedAccessPermissions.READ + azureStorage.BlobUtilities.SharedAccessPermissions.LIST,
        Start: azureStorage.date.secondsFromNow(-10),
        // for clock desync
        Expiry: azureStorage.date.minutesFromNow(60),
        ResourceTypes: azureStorage.BlobUtilities.BlobContainerPublicAccessType.BLOB
        }
    });

    return blobService.getUrl(containerName, blobName, sasToken, true);
}
