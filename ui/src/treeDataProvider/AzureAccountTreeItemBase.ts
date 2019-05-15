/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Disposable, Extension, extensions } from 'vscode';
import * as vscode from 'vscode';
import * as types from '../../index';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter } from '../azure-account.api';
import { localize } from '../localize';
import { TestAzureAccount } from '../TestAzureAccount';
import { nonNullProp, nonNullValue } from '../utils/nonNull';
import { AzureWizardPromptStep } from '../wizard/AzureWizardPromptStep';
import { AzExtParentTreeItem } from './AzExtParentTreeItem';
import { AzExtTreeItem } from './AzExtTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { SubscriptionTreeItemBase } from './SubscriptionTreeItemBase';

const signInLabel: string = localize('signInLabel', 'Sign in to Azure...');
const createAccountLabel: string = localize('createAccountLabel', 'Create a Free Azure Account...');
const selectSubscriptionsLabel: string = localize('noSubscriptions', 'Select Subscriptions...');
const signInCommandId: string = 'azure-account.login';
const createAccountCommandId: string = 'azure-account.createAccount';
const selectSubscriptionsCommandId: string = 'azure-account.selectSubscriptions';

export abstract class AzureAccountTreeItemBase extends AzExtParentTreeItem implements types.AzureAccountTreeItemBase {
    public static contextValue: string = 'azureextensionui.azureAccount';
    public readonly contextValue: string = AzureAccountTreeItemBase.contextValue;
    public readonly label: string = 'Azure';
    public readonly childTypeLabel: string = localize('subscription', 'subscription');
    public autoSelectInTreeItemPicker: boolean = true;
    public disposables: Disposable[] = [];

    private _azureAccount: AzureAccount;
    private _subscriptionTreeItems: SubscriptionTreeItemBase[] | undefined;

    constructor(parent?: AzExtParentTreeItem, testAccount?: TestAzureAccount) {
        super(parent);
        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: Extension<AzureAccount> | undefined = extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (testAccount) {
            this._azureAccount = testAccount;
        } else if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is a required depenency.'));
        } else {
            this._azureAccount = azureAccountExtension.exports;
        }

        this.disposables.push(this._azureAccount.onFiltersChanged(async () => await this.refresh()));
        this.disposables.push(this._azureAccount.onStatusChanged(async (status: AzureLoginStatus) => {
            // Ignore status change to 'LoggedIn' and wait for the 'onFiltersChanged' event to fire instead
            // (so that the tree stays in 'Loading...' state until the filters are actually ready)
            if (status !== 'LoggedIn') {
                await this.refresh();
            }
        }));
    }

    //#region Methods implemented by base class
    public abstract createSubscriptionTreeItem(root: types.ISubscriptionRoot): SubscriptionTreeItemBase | Promise<SubscriptionTreeItemBase>;
    //#endregion

    public dispose(): void {
        Disposable.from(...this.disposables).dispose();
    }

    public hasMoreChildrenImpl(): boolean {
        return false;
    }

    public async loadMoreChildrenImpl(_clearCache: boolean): Promise<AzExtTreeItem[]> {
        const existingSubscriptions: SubscriptionTreeItemBase[] = this._subscriptionTreeItems ? this._subscriptionTreeItems : [];
        this._subscriptionTreeItems = [];

        const contextValue: string = 'azureCommand';
        if (this._azureAccount.status === 'Initializing' || this._azureAccount.status === 'LoggingIn') {
            return [new GenericTreeItem(this, {
                label: this._azureAccount.status === 'Initializing' ? localize('loadingTreeItem', 'Loading...') : localize('signingIn', 'Waiting for Azure sign-in...'),
                commandId: signInCommandId,
                contextValue,
                id: signInCommandId,
                iconPath: {
                    light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Loading.svg'),
                    dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                }
            })];
        } else if (this._azureAccount.status === 'LoggedOut') {
            return [
                new GenericTreeItem(this, { label: signInLabel, commandId: signInCommandId, contextValue, id: signInCommandId, includeInTreeItemPicker: true }),
                new GenericTreeItem(this, { label: createAccountLabel, commandId: createAccountCommandId, contextValue, id: createAccountCommandId, includeInTreeItemPicker: true })
            ];
        }

        await this._azureAccount.waitForFilters();

        if (this._azureAccount.filters.length === 0) {
            return [
                new GenericTreeItem(this, { label: selectSubscriptionsLabel, commandId: selectSubscriptionsCommandId, contextValue, id: selectSubscriptionsCommandId, includeInTreeItemPicker: true })
            ];
        } else {
            this._subscriptionTreeItems = await Promise.all(this._azureAccount.filters.map(async (filter: AzureResourceFilter) => {
                const existingTreeItem: SubscriptionTreeItemBase | undefined = existingSubscriptions.find(ti => ti.id === filter.subscription.id);
                if (existingTreeItem) {
                    // Return existing treeItem (which might have many 'cached' tree items underneath it) rather than creating a brand new tree item every time
                    return existingTreeItem;
                } else {
                    // filter.subscription.id is the The fully qualified ID of the subscription (For example, /subscriptions/00000000-0000-0000-0000-000000000000) and should be used as the tree item's id for the purposes of OpenInPortal
                    // filter.subscription.subscriptionId is just the guid and is used in all other cases when creating clients for managing Azure resources
                    return await this.createSubscriptionTreeItem({
                        credentials: filter.session.credentials,
                        subscriptionDisplayName: nonNullProp(filter.subscription, 'displayName'),
                        subscriptionId: nonNullProp(filter.subscription, 'subscriptionId'),
                        subscriptionPath: nonNullProp(filter.subscription, 'id'),
                        tenantId: filter.session.tenantId,
                        userId: filter.session.userId,
                        environment: filter.session.environment
                    });
                }
            }));
            return this._subscriptionTreeItems;
        }
    }

    public async getSubscriptionPromptStep(wizardContext: Partial<types.ISubscriptionWizardContext>): Promise<types.AzureWizardPromptStep<types.ISubscriptionWizardContext> | undefined> {
        const subscriptions: SubscriptionTreeItemBase[] = await this.ensureSubscriptionTreeItems();
        if (subscriptions.length === 1) {
            assignRootToWizardContext(wizardContext, subscriptions[0].root);
            return undefined;
        } else {
            // tslint:disable-next-line: no-var-self
            const me: AzureAccountTreeItemBase = this;
            class SubscriptionPromptStep extends AzureWizardPromptStep<types.ISubscriptionWizardContext> {
                public async prompt(): Promise<void> {
                    const ti: SubscriptionTreeItemBase = <SubscriptionTreeItemBase>await me.treeDataProvider.showTreeItemPicker(SubscriptionTreeItemBase.contextValue);
                    assignRootToWizardContext(wizardContext, ti.root);
                }
                public shouldPrompt(): boolean { return !(<types.ISubscriptionWizardContext>wizardContext).subscriptionId; }
            }
            return new SubscriptionPromptStep();
        }
    }

    public async pickTreeItemImpl(_expectedContextValues: (string | RegExp)[]): Promise<AzExtTreeItem | undefined> {
        if (this._azureAccount.status === 'LoggingIn' || this._azureAccount.status === 'Initializing') {
            const title: string = localize('waitingForAzureSignin', 'Waiting for Azure sign-in...');
            await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title }, async (): Promise<boolean> => await this._azureAccount.waitForSubscriptions());
        }

        return undefined;
    }

    private async ensureSubscriptionTreeItems(): Promise<SubscriptionTreeItemBase[]> {
        if (!this._subscriptionTreeItems) {
            await this.getCachedChildren();
        }

        return nonNullValue(this._subscriptionTreeItems, 'subscriptionTreeItems');
    }
}

/**
 * Copies all necessary props and _only_ necessary props to wizardContext
 */
function assignRootToWizardContext(wizardContext: Partial<types.ISubscriptionWizardContext>, root: types.ISubscriptionRoot): void {
    // Intentionally using a new const so that TypeScript will verify I'm specifying all props required by ISubscriptionWizardContext
    const subscriptionContext: types.ISubscriptionWizardContext = {
        credentials: root.credentials,
        environment: root.environment,
        subscriptionDisplayName: root.subscriptionDisplayName,
        subscriptionId: root.subscriptionId
    };
    Object.assign(wizardContext, subscriptionContext);
}
