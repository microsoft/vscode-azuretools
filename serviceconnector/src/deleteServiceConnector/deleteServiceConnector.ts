/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, IActionContext, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import { ServiceConnectorItem } from "../createServiceConnector/createServiceConnector";
import { localize } from "../localize";
import { DeleteLinkerStep } from "./DeleteLinkerStep";
import { IPickLinkerContext } from "./IPickLinkerContext";
import { ServiceConnectorsListStep } from "./ServiceConnectorsListStep";

export async function deleteLinker(context: IActionContext, item: ServiceConnectorItem | AzExtTreeItem): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription);

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        resourceUri: item?.id,
    }

    const title: string = localize('deleteConnector', 'Delete service connector');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new ServiceConnectorsListStep()
    ];

    const executeSteps: AzureWizardExecuteStep<IPickLinkerContext>[] = [
        new DeleteLinkerStep()
    ];

    const wizard: AzureWizard<IPickLinkerContext> = new AzureWizard(wizardContext, {
        title,
        promptSteps,
        executeSteps
    });

    await wizard.prompt();
    await wizard.execute();
}
