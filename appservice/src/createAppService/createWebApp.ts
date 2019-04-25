/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Site } from 'azure-arm-website/lib/models';
import { IActionContext, ISubscriptionWizardContext } from 'vscode-azureextensionui';
import { createAppService } from './createAppService';
import { IAppCreateOptions } from './IAppCreateOptions';

// Should be moved to appservice repo: https://github.com/Microsoft/vscode-azureappservice/issues/780
export async function createWebApp(
    actionContext: IActionContext,
    subscriptionContext: ISubscriptionWizardContext,
    createOptions?: IAppCreateOptions,
    showCreatingTreeItem?: (label: string) => void): Promise<Site> {
    return await createAppService(actionContext, subscriptionContext, createOptions, showCreatingTreeItem);
}
