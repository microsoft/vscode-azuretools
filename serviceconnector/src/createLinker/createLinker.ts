/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { KnownClientType } from "@azure/arm-servicelinker";
import { AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, ExecuteActivityContext, IActionContext, ISubscriptionContext, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import * as vscode from 'vscode';
import { AuthenticationListStep } from "./AuthenticationListStep";
import { ClientListStep } from "./ClientListStep";
import { ICreateLinkerContext } from "./ICreateLinkerContext";
import { LinkerCreateStep } from "./LinkerCreateStep";
import { LinkerNameStep } from "./LinkerNameStep";
import { TargetServiceListStep } from "./TargetServiceListStep";

export interface LinkerItem {
    subscription: AzureSubscription,
    id: string,
}

export async function createLinker(context: IActionContext & ExecuteActivityContext, id: string, subscription: ISubscriptionContext | AzureSubscription, preSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [], runtime?: KnownClientType[]): Promise<void> {
    subscription = isAzureSubscription(subscription) ? createSubscriptionContext(subscription) : subscription; // For v1.5 compatibility

    const wizardContext: ICreateLinkerContext = {
        ...context,
        ...subscription,
        runtime,
        sourceResourceUri: id,
    }

    const promptSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [
        new TargetServiceListStep(),
        new LinkerNameStep(),
        new ClientListStep(),
        new AuthenticationListStep(),
    ];

    preSteps.forEach(step => promptSteps.unshift(step));

    const executeSteps: AzureWizardExecuteStep<ICreateLinkerContext>[] = [
        new LinkerCreateStep(),
    ];

    const wizard: AzureWizard<ICreateLinkerContext> = new AzureWizard(wizardContext, {
        title: vscode.l10n.t('Create Service Connector'),
        promptSteps,
        executeSteps,
    });

    await wizard.prompt();
    await wizard.execute();
}

export function isAzureSubscription(subscription: ISubscriptionContext | AzureSubscription): subscription is AzureSubscription {
    return 'subscription' in subscription;
}
