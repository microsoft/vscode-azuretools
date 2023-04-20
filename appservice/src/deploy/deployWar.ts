/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IActionContext } from '@microsoft/vscode-azext-utils';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { publisherName } from '../constants';
import { ParsedSite } from '../SiteClient';
import { getFileExtension } from '../utils/pathUtils';
import { waitForDeploymentToComplete } from './waitForDeploymentToComplete';

export async function deployWar(context: IActionContext, site: ParsedSite, fsPath: string): Promise<void> {
    if (getFileExtension(fsPath) !== 'war') {
        throw new Error(vscode.l10n.t('Path specified is not a war file'));
    }

    const kuduClient = await site.createClient(context);
    await kuduClient.warPushDeploy(context, () => fs.createReadStream(fsPath), {
        isAsync: true,
        author: publisherName,
        deployer: publisherName,
        trackDeploymentId: true
    });

    await waitForDeploymentToComplete(context, site);
}
