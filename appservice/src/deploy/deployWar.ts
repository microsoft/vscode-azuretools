/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { IActionContext } from 'vscode-azureextensionui';
import { createKuduClient } from '../createKuduClient';
import { localize } from '../localize';
import { SiteClient } from '../SiteClient';
import { getFileExtension } from '../utils/pathUtils';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployWar(context: IActionContext, client: SiteClient, fsPath: string): Promise<void> {
    if (getFileExtension(fsPath) !== 'war') {
        throw new Error(localize('NotAWarError', 'Path specified is not a war file'));
    }

    const kuduClient = await createKuduClient(context, client);
    await kuduClient.pushDeployment.warPushDeploy(() => fs.createReadStream(fsPath), { isAsync: true });
    await waitForDeploymentToComplete(context, client);
}
