/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ExecuteActivityContext, IActionContext, createSubscriptionContext, nonNullValue } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import * as vscode from 'vscode';
import { AuthenticationTypeStep } from "./AuthenticationTypeStep";
import { ClientTypeStep } from "./ClientTypeStep";
import { CreateLinkerStep } from "./CreateLinkerStep";
import { ICreateLinkerContext } from "./ICreateLinkerContext";
import { LinkerNameStep } from "./LinkerNameStep";
import { TargetServiceTypeStep } from "./TargetServiceTypeStep";

export interface LinkerItem {
    subscription: AzureSubscription,
    id: string,
}

export async function createLinker(context: IActionContext & ExecuteActivityContext, item: LinkerItem | AzExtTreeItem, preSteps?: AzureWizardPromptStep<ICreateLinkerContext>[]): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription); // For v1.5 compatibility

    const wizardContext: ICreateLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: nonNullValue(item?.id),
    }

    const promptSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [
        new TargetServiceTypeStep(),
        new LinkerNameStep(),
        new ClientTypeStep(),
        new AuthenticationTypeStep(),
    ];

    promptSteps.unshift(...nonNullValue(preSteps));

    const executeSteps: AzureWizardExecuteStep<ICreateLinkerContext>[] = [
        new CreateLinkerStep(),
    ];

    const wizard: AzureWizard<ICreateLinkerContext> = new AzureWizard(wizardContext, {
        title: vscode.l10n.t('Create Service Connector'),
        promptSteps,
        executeSteps,
    });

    await wizard.prompt();
    await wizard.execute();
}
