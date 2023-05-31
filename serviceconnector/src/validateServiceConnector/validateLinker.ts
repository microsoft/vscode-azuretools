/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.md in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzExtTreeItem, AzureWizard, AzureWizardExecuteStep, AzureWizardPromptStep, createSubscriptionContext } from "@microsoft/vscode-azext-utils";
import * as vscode from 'vscode';
import { LinkerItem } from "../createServiceConnector/createLinker";
import { IPickLinkerContext } from "../deleteServiceConnector/IPickLinkerContext";
import { LinkerListStep } from "../deleteServiceConnector/LinkerListStep";
import { ValidateLinkerStep } from "./ValidateLinkerStep";

export async function validateLinker(context: IPickLinkerContext, item: LinkerItem | AzExtTreeItem): Promise<void> {
    const subscription = item instanceof AzExtTreeItem ? item.subscription : createSubscriptionContext(item.subscription);

    const wizardContext: IPickLinkerContext = {
        ...context,
        ...subscription,
        sourceResourceUri: item?.id,
    }

    const title: string = vscode.l10n.t('Validate service connector');

    const promptSteps: AzureWizardPromptStep<IPickLinkerContext>[] = [
        new LinkerListStep()
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
