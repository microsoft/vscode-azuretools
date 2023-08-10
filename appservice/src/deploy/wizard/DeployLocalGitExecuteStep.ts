/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { InnerDeployContext } from "../IDeployContext";
import { localGitDeploy } from "../localGitDeploy";
import { DeployExecuteBaseStep } from "./DeployExecuteBaseStep";

export class DeployLocalGitExecuteStep extends DeployExecuteBaseStep {
    public async deployCore(context: InnerDeployContext): Promise<void> {
        await localGitDeploy(context.site, { fsPath: context.workspaceFolder.uri.fsPath }, context);
    }
}
