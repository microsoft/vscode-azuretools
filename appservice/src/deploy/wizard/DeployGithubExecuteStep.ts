/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { l10n } from "vscode";
import { InnerDeployContext } from "../IDeployContext";
import { DeployExecuteBaseStep } from "./DeployExecuteBaseStep";

export class DeployGitHubExecuteStep extends DeployExecuteBaseStep {
    public async deployCore(context: InnerDeployContext): Promise<void> {
        throw new Error(l10n.t('"{0}" is connected to a GitHub repository. Push to GitHub repository to deploy.', context.site.fullName));
    }
}
