/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { IActionContext } from 'vscode-azureextensionui';
import { KuduClient } from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployWar(context: IActionContext, client: SiteClient, fsPath: string): Promise<void> {
    if (FileUtilities.getFileExtension(fsPath) !== 'war') {
        throw new Error(localize('NotAWarError', 'Path specified is not a war file'));
    }

    ext.outputChannel.appendLog(localize('deployStart', 'Starting deployment...'), { resourceName: client.fullName });
    const kuduClient: KuduClient = await client.getKuduClient();
    await kuduClient.pushDeployment.warPushDeploy(fs.createReadStream(fsPath), { isAsync: true });
    await waitForDeploymentToComplete(context, client);
}
