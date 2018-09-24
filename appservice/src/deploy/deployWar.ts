/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import KuduClient from 'vscode-azurekudu';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { getKuduClient } from '../getKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployWar(client: SiteClient, fsPath: string): Promise<void> {
    const kuduClient: KuduClient = await getKuduClient(client);
    if (FileUtilities.getFileExtension(fsPath) !== 'war') {
        throw new Error(localize('NotAWarError', 'Path specified is not a war file'));
    }

    ext.outputChannel.appendLine(formatDeployLog(client, localize('deployStart', 'Starting deployment...')));
    await kuduClient.pushDeployment.warPushDeploy(fs.createReadStream(fsPath), { isAsync: true });
    await waitForDeploymentToComplete(client, kuduClient);
}
