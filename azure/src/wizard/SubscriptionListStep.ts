/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the MIT License. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { AzureExtensionApiProvider } from "@microsoft/vscode-azext-utils/api";
import { AzureSubscription } from "@microsoft/vscode-azext-utils/hostapi.v2";
import * as vscode from "vscode";
import { SubscriptionListStepContext } from "../../index";
import { AzureAccountExtensionApi } from "../azure-account.api";
import { localize } from "../localize";
import { createAzureSubscription } from "../utils/createAzureSubscription";
import { createSubscriptionContext } from "../utils/credentialUtils";
import { GenericListStepContext, ResourceListPick, ResourceListStep } from "./ResourceListStep";

export class SubscriptionListStep extends ResourceListStep<SubscriptionListStepContext, AzureSubscription> {
    constructor() {
        super({
            loadingPlaceHolder: localize('loadingSubscriptions', 'Loading subscriptions...'),
            matchOnDescription: true,
            placeHolder: localize('selectSubscription', 'Select a subscription'),
        });
    }

    async getQuickPicks(wizardContext: GenericListStepContext<AzureSubscription> & SubscriptionListStepContext): Promise<ResourceListPick<AzureSubscription>[]> {
        const api = await this.getAzureAccountExtensionApi();
        const subscriptions: AzureSubscription[] = api.filters.map(createAzureSubscription);

        if (subscriptions.length === 0) {
            return [{
                label: 'Select subscriptions...',
                data: 'command',
                commandId: 'azure-account.selectSubscriptions',
            }];
        }
        else if (subscriptions.length === 1) {
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

    private async getAzureAccountExtensionApi(): Promise<AzureAccountExtensionApi> {
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
}
