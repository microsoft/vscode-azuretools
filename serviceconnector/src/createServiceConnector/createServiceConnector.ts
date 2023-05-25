/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, createSubscriptionContext, nonNullValue } from "@microsoft/vscode-azext-utils";
import { AzureSubscription } from "@microsoft/vscode-azureresources-api";
import { localize } from "../localize";
import { AuthenticationTypeStep } from "./AuthenticationTypeStep";
import { ClientTypeStep } from "./ClientTypeStep";
import { CreateLinkerStep } from "./CreateLinkerStep";
import { ICreateLinkerContext } from "./ICreateLinkerContext";
import { LinkerNameStep } from "./LinkerNameStep";
import { ServiceTypeStep } from "./ServiceTypeStep";

export interface ServiceConnectorItem {
    subscription: AzureSubscription,
    id: string,
}

export async function createLinker(context: IActionContext, item: ServiceConnectorItem | AzExtTreeItem): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription);
    const wizardContext: ICreateLinkerContext = {
        ...context,
        ...subscription,
        resourceUri: nonNullValue(item?.id),
    }

    const title: string = localize('createConnector', 'Create Service Connector');

    const promptSteps: AzureWizardPromptStep<ICreateLinkerContext>[] = [
        new ServiceTypeStep(),
        new LinkerNameStep(),
        new ClientTypeStep(),
        new AuthenticationTypeStep(),
    ];

    const executeSteps: AzureWizardExecuteStep<ICreateLinkerContext>[] = [
        new CreateLinkerStep(),
    ];

    const wizard: AzureWizard<ICreateLinkerContext> = new AzureWizard(wizardContext, {
        title,
        promptSteps,
        executeSteps,
    });

    await wizard.prompt();
    await wizard.execute();
}

