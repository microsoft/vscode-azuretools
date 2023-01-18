/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IActionContext, UserCancelledError } from "@microsoft/vscode-azext-utils";
import { AzureExtensionApiProvider } from "@microsoft/vscode-azext-utils/api";
import { AzureSubscription } from "@microsoft/vscode-azext-utils/hostapi.v2";
import * as vscode from "vscode";
import { AzExtCommand, SubscriptionListStepContext } from "../../index";
import { AzureAccountExtensionApi } from "../azure-account.api";
import { localize } from "../localize";
import { createAzureSubscription } from "../utils/createAzureSubscription";
import { createSubscriptionContext } from "../utils/credentialUtils";
import { GetQuickPicksContext, ResourceListPick, ResourceListStep } from "./ResourceListStep";

export const notLoggedInCommands: AzExtCommand[] = [
    {
        label: localize('signInLabel', 'Sign in to Azure...'),
        commandId: 'azure-account.login',
        iconPath: new vscode.ThemeIcon('sign-in')
    },
    {
        label: localize('createAccountLabel', 'Create an Azure Account...'),
        commandId: 'azure-account.createAccount',
        iconPath: new vscode.ThemeIcon('add')
    },
    {
        label: localize('createStudentAccount', 'Create an Azure for Students Account...'),
        commandId: 'azureResourceGroups.openUrl',
        commandArgs: ['https://aka.ms/student-account'],
        iconPath: new vscode.ThemeIcon('mortar-board')
    },
];

export class SubscriptionListStep extends ResourceListStep<SubscriptionListStepContext, AzureSubscription> {
    constructor() {
        super({
            loadingPlaceHolder: localize('loadingSubscriptions', 'Loading subscriptions...'),
            matchOnDescription: true,
            placeHolder: localize('selectSubscription', 'Select subscription'),
        });
    }

    async getQuickPicks(wizardContext: GetQuickPicksContext<AzureSubscription> & SubscriptionListStepContext): Promise<ResourceListPick<AzureSubscription>[]> {
        const api = await getAzureAccountExtensionApi();
        await api.waitForFilters();
        const subscriptions: AzureSubscription[] = api.filters.map(createAzureSubscription);

        if (subscriptions.length === 1) {
            wizardContext.autoSelectResource(subscriptions[0]);
        } else {
            return subscriptions.map(subscription => ({ data: subscription, label: subscription.name, description: subscription.subscriptionId }));
        }
    }

    onPickResource(wizardContext: SubscriptionListStepContext, subscription: AzureSubscription): void {
        wizardContext.subscription = subscription;
        Object.assign(wizardContext, createSubscriptionContext(subscription));
    }

    shouldPrompt(context: SubscriptionListStepContext): boolean {
        return !context.subscription;
    }
}

export async function getSubscriptionListStep(context: IActionContext): Promise<AzureWizardPromptStep<SubscriptionListStepContext>> {
    const api = await getAzureAccountExtensionApi();
    await api.waitForFilters();

    if (api.status !== 'LoggedIn') {
        const pick = await context.ui.showQuickPick(notLoggedInCommands, {
            placeHolder: localize('signInToAzure', 'Sign in or Create an Account...'),
        });

        await vscode.commands.executeCommand(pick.commandId, ...(pick.commandArgs ?? []));
        await api.waitForFilters();
    }

    if (api.filters.length === 0) {
        await vscode.commands.executeCommand('azure-account.selectSubscriptions');
    }

    await api.waitForFilters();
    if (api.filters.length === 0) {
        throw new UserCancelledError();
    }

    return new SubscriptionListStep();
}


async function getAzureAccountExtensionApi(): Promise<AzureAccountExtensionApi> {
    const extension = vscode.extensions.getExtension<AzureExtensionApiProvider>('ms-vscode.azure-account');

    if (extension) {
        if (!extension.isActive) {
            await extension.activate();
        }

        const api = extension.exports.getApi<AzureAccountExtensionApi>('1');
        await api.waitForFilters();
        return api;
    } else {
        throw new Error('Azure Account extension is not installed.');
    }
}
