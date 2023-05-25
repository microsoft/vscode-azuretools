/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import { ServiceConnectorItem } from "../createServiceConnector/createServiceConnector";
import { IPickLinkerContext } from "../deleteServiceConnector/IPickLinkerContext";
import { ServiceConnectorsListStep } from "../deleteServiceConnector/ServiceConnectorsListStep";
import { localize } from "../localize";
import { ValidateLinkerStep } from "./ValidateLinkerStep";

export async function validateLinker(context: IPickLinkerContext, item: ServiceConnectorItem | AzExtTreeItem): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription);

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        resourceUri: item?.id,
    }

    const title: string = localize('deleteConnector', 'Validate service connector');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new ServiceConnectorsListStep()
    ];

    const executeSteps: AzureWizardExecuteStep<IPickLinkerContext>[] = [
        new ValidateLinkerStep()
    ];

    const wizard: AzureWizard<IPickLinkerContext> = new AzureWizard(wizardContext, {
        title,
        promptSteps,
        executeSteps
    });

    await wizard.prompt();
    await wizard.execute();
}
