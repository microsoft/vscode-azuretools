/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import * as vscode from 'vscode';
import { QuickPickOptions } from 'vscode';
import { AzureAccount, AzureResourceFilter } from '../azure-account.api';
import { UserCancelledError } from '../errors';
import { localize } from '../localize';
import { IQuickPickItemWithData } from '../wizard/IQuickPickItemWithData';
import { WizardBase } from '../wizard/WizardBase';
import { WizardStep } from '../wizard/WizardStep';

export class SubscriptionStep extends WizardStep {
    public readonly azureAccount: AzureAccount;
    private _subscriptionFilter: AzureResourceFilter | undefined;
    private readonly _credentials: ServiceClientCredentials | undefined;
    private readonly _subscription: Subscription | undefined;
    private readonly _prompt: string;

    constructor(wizard: WizardBase, azureAccount: AzureAccount, prompt: string, credentials?: ServiceClientCredentials, subscription?: Subscription) {
        super(wizard);
        this.azureAccount = azureAccount;
        this._prompt = prompt;
        this._credentials = credentials;
        this._subscription = subscription;
    }

    public async prompt(): Promise<void> {
        if (this._credentials !== undefined && this._subscription !== undefined) {
            return;
        }

        // If not signed in, execute the sign in command and wait for it...
        if (this.azureAccount.status !== 'LoggedIn') {
            await vscode.commands.executeCommand('azure-account.login');
        }
        // Now check again, if still not signed in, cancel.
        if (this.azureAccount.status !== 'LoggedIn') {
            throw new UserCancelledError();
        }

        const quickPickOptions: QuickPickOptions = { placeHolder: `${this._prompt} (${this.stepProgressText})` };
        this._subscriptionFilter = await this.showQuickPick(this.getSubscriptionsAsQuickPickItems(), quickPickOptions, 'NewWebApp.Subscription');
    }

    public get credentials(): ServiceClientCredentials {
        return this._credentials || this._subscriptionFilter.session.credentials;
    }

    public get subscription(): Subscription {
        return this._subscription || this._subscriptionFilter.subscription;
    }

    public async execute(): Promise<void> {
        this.wizard.writeline(localize('UsingSubscription', 'Using Subscription "{0} ({1})".', this._subscriptionFilter.subscription.displayName, this._subscriptionFilter.subscription.subscriptionId));
    }

    private async getSubscriptionsAsQuickPickItems(): Promise<IQuickPickItemWithData<AzureResourceFilter>[]> {
        return await Promise.resolve(
            this.azureAccount.filters.map((f: AzureResourceFilter) => {
                return {
                    persistenceId: f.subscription.subscriptionId,
                    label: f.subscription.displayName,
                    description: '',
                    detail: f.subscription.subscriptionId,
                    data: f
                };
            })
        );
    }
}
