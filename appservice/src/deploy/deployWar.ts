/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { ext } from '../extensionVariables';
import * as FileUtilities from '../FileUtilities';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { formatDeployLog } from './formatDeployLog';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployWar(client: SiteClient, fsPath: string): Promise<void> {
    if (FileUtilities.getFileExtension(fsPath) !== 'war') {
        throw new Error(localize('NotAWarError', 'Path specified is not a war file'));
    }

    ext.outputChannel.appendLine(formatDeployLog(client, localize('deployStart', 'Starting deployment...')));
    await client.kudu.pushDeployment.warPushDeploy(fs.createReadStream(fsPath), { isAsync: true });
    await waitForDeploymentToComplete(client);
}
