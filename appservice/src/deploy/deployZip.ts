/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as vscode from 'vscode';
import KuduClient from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployZip(client: SiteClient, fsPath: string, configurationSectionName: string): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);
    let zipFilePath: string;
    let createdZip: boolean = false;
    if (FileUtilities.getFileExtension(fsPath) === 'zip') {
        zipFilePath = fsPath;
    } else {
        createdZip = true;
        ext.outputChannel.appendLine(formatDeployLog(client, localize('zipCreate', 'Creating zip package...')));
        zipFilePath = await getZipFileToDeploy(fsPath, configurationSectionName);
    }

    try {
        ext.outputChannel.appendLine(formatDeployLog(client, localize('deployStart', 'Starting deployment...')));
        await kuduClient.pushDeployment.zipPushDeploy(fs.createReadStream(zipFilePath), { isAsync: true });
        await waitForDeploymentToComplete(client, kuduClient);
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

async function getZipFileToDeploy(fsPath: string, configurationSectionName?: string): Promise<string> {
    if (!(await fse.pathExists(fsPath))) {
        throw new Error('Could not zip a non-exist file path.');
    }
    if (await FileUtilities.isDirectory(fsPath)) {
        const zipDeployConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(configurationSectionName, vscode.Uri.file(fsPath));
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const globPattern: string = zipDeployConfig.get<string>('zipGlobPattern');
        // tslint:disable-next-line:no-backbone-get-set-outside-model
        const ignorePattern: string | string[] = zipDeployConfig.get<string | string[]>('zipIgnorePattern');
        return FileUtilities.zipDirectory(fsPath, globPattern, ignorePattern);
    } else {
        return FileUtilities.zipFile(fsPath);
    }
}
