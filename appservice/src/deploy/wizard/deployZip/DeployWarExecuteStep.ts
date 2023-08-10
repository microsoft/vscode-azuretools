/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { l10n } from "vscode";
import { publisherName } from '../../../constants';
import { getFileExtension } from "../../../utils/pathUtils";
import { InnerDeployContext } from "../../IDeployContext";
import { DeployZipBaseExecuteStep } from "./DeployZipBaseExecuteStep";

export class DeployWarExecuteStep extends DeployZipBaseExecuteStep {
    public async deployZip(context: InnerDeployContext): Promise<void> {
        if (getFileExtension(context.workspaceFolder.uri.fsPath) !== 'war') {
            throw new Error(l10n.t('Path specified is not a war file'));
        }

        const kuduClient = await context.site.createClient(context);
        await kuduClient.warPushDeploy(context, () => fs.createReadStream(context.workspaceFolder.uri.fsPath), {
            isAsync: true,
            author: publisherName,
            deployer: publisherName,
            trackDeploymentId: true
        });
    }
}
