/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, Event, EventEmitter, Extension, extensions, QuickPickOptions, TreeItem } from 'vscode';
import { IActionContext, IAzureQuickPickItem, ISubscriptionRoot } from '../../index';
import * as types from '../../index';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter } from '../azure-account.api';
import { callWithTelemetryAndErrorHandling } from '../callWithTelemetryAndErrorHandling';
import { ArgumentError, UserCancelledError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { TestAzureAccount } from '../TestAzureAccount';
import { AzureWizardPromptStep } from '../wizard/AzureWizardPromptStep';
import { AzureParentTreeItem } from './AzureParentTreeItem';
import { AzureTreeItem } from './AzureTreeItem';
import { GenericTreeItem } from './GenericTreeItem';
import { IAzureTreeDataProviderInternal } from './InternalInterfaces';
import { RootTreeItem } from './RootTreeItem';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';
import { loadMoreLabel } from './treeConstants';

const signInLabel: string = localize('signInLabel', 'Sign in to Azure...');
const createAccountLabel: string = localize('createAccountLabel', 'Create a Free Azure Account...');
const signInCommandId: string = 'azure-account.login';
const createAccountCommandId: string = 'azure-account.createAccount';

type SubscriptionTreeItemType = { new(root: ISubscriptionRoot): SubscriptionTreeItem };

export class AzureTreeDataProvider<TRoot = ISubscriptionRoot> implements IAzureTreeDataProviderInternal<TRoot | ISubscriptionRoot>, types.AzureTreeDataProvider<TRoot> {
    public _onTreeItemCreateEmitter: EventEmitter<AzureTreeItem<TRoot | ISubscriptionRoot>> = new EventEmitter<AzureTreeItem<TRoot | ISubscriptionRoot>>();
    private _onDidChangeTreeDataEmitter: EventEmitter<AzureTreeItem<TRoot | ISubscriptionRoot>> = new EventEmitter<AzureTreeItem<TRoot | ISubscriptionRoot>>();

    private readonly _loadMoreCommandId: string;
    private _subscriptionTreeItemType: SubscriptionTreeItemType;
    private _azureAccount: AzureAccount;
    private _customRootTreeItems: AzureTreeItem<TRoot>[];

    private _subscriptionTreeItems: AzureTreeItem<ISubscriptionRoot>[] | undefined;

    private _disposables: Disposable[] = [];

    constructor(subscriptionTreeItemType: SubscriptionTreeItemType, loadMoreCommandId: string, rootTreeItems?: RootTreeItem<TRoot>[], testAccount?: TestAzureAccount) {
        this._subscriptionTreeItemType = subscriptionTreeItemType;
        this._loadMoreCommandId = loadMoreCommandId;
        // tslint:disable:strict-boolean-expressions
        this._customRootTreeItems = rootTreeItems || [];
        this._customRootTreeItems.forEach((ti: RootTreeItem<TRoot>) => ti.treeDataProvider = <IAzureTreeDataProviderInternal<TRoot>>this);

        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: Extension<AzureAccount> | undefined = extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (testAccount) {
            this._azureAccount = testAccount;
        } else if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is required for the App Service tools.'));
        } else {
            this._azureAccount = azureAccountExtension.exports;
        }

        this._disposables.push(this._azureAccount.onFiltersChanged(() => this.refreshUIOnly(undefined)));
        this._disposables.push(this._azureAccount.onStatusChanged((status: AzureLoginStatus) => {
            // Ignore status change to 'LoggedIn' and wait for the 'onFiltersChanged' event to fire instead
            // (so that the tree stays in 'Loading...' state until the filters are actually ready)
            if (status !== 'LoggedIn') {
                this.refreshUIOnly(undefined);
            }
        }));
    }

    public dispose(): void {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }

    public get onDidChangeTreeData(): Event<AzureTreeItem<TRoot | ISubscriptionRoot>> {
        return this._onDidChangeTreeDataEmitter.event;
    }

    public get onTreeItemCreate(): Event<AzureTreeItem<TRoot | ISubscriptionRoot>> {
        return this._onTreeItemCreateEmitter.event;
    }

    public getTreeItem(treeItem: AzureTreeItem<TRoot | ISubscriptionRoot>): TreeItem {
        return {
            label: treeItem.effectiveLabel,
            id: treeItem.fullId,
            collapsibleState: treeItem.collapsibleState,
            contextValue: treeItem.contextValue,
            iconPath: treeItem.effectiveIconPath,
            command: treeItem.commandId ? {
                command: treeItem.commandId,
                title: '',
                arguments: [treeItem]
            } : undefined
        };
    }

    public async getChildren(treeItem?: AzureParentTreeItem<TRoot | ISubscriptionRoot>): Promise<AzureTreeItem<TRoot | ISubscriptionRoot>[]> {
        try {
            // tslint:disable:no-var-self
            const thisTree: AzureTreeDataProvider<TRoot> = this;
            return <AzureTreeItem<TRoot | ISubscriptionRoot>[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', async function (this: IActionContext): Promise<AzureTreeItem<TRoot | ISubscriptionRoot>[]> {
                const actionContext: IActionContext = this;
                // tslint:enable:no-var-self
                actionContext.suppressErrorDisplay = true;
                actionContext.rethrowError = true;
                let result: AzureTreeItem<TRoot | ISubscriptionRoot>[];

                if (treeItem !== undefined) {
                    actionContext.properties.contextValue = treeItem.contextValue;

                    const cachedChildren: AzureTreeItem<TRoot | ISubscriptionRoot>[] = await treeItem.getCachedChildren();
                    const hasMoreChildren: boolean = treeItem.hasMoreChildrenImpl();
                    actionContext.properties.hasMoreChildren = String(hasMoreChildren);

                    result = treeItem.creatingTreeItems.concat(cachedChildren);
                    if (hasMoreChildren) {
                        result = result.concat(new GenericTreeItem(treeItem, {
                            label: loadMoreLabel,
                            iconPath: {
                                light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'refresh.svg'),
                                dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'refresh.svg')
                            },
                            contextValue: 'azureLoadMore',
                            commandId: thisTree._loadMoreCommandId
                        }));
                    }
                } else { // Root of tree
                    result = await thisTree.populateRoots(actionContext);
                }

                this.measurements.childCount = result.length;
                return result;
            });
        } catch (error) {
            return [new GenericTreeItem(treeItem, {
                label: localize('errorTreeItem', 'Error: {0}', parseError(error).message),
                contextValue: 'azureextensionui.error'
            })];
        }
    }

    public async refresh(treeItem?: AzureTreeItem<TRoot | ISubscriptionRoot>): Promise<void> {
        async function refreshTreeItem(ti: AzureTreeItem<TRoot | ISubscriptionRoot>): Promise<void> {
            if (ti.refreshImpl) {
                await ti.refreshImpl();
            }
            if (ti instanceof AzureParentTreeItem) {
                ti.clearCache();
            }
        }

        if (!treeItem) {
            this._subscriptionTreeItems = [];
            await Promise.all(this._customRootTreeItems.map(async (root: AzureTreeItem<TRoot>) => await refreshTreeItem(root)));
        } else {
            await refreshTreeItem(treeItem);
        }

        this.refreshUIOnly(treeItem);
    }

    public refreshUIOnly(treeItem: AzureTreeItem<TRoot | ISubscriptionRoot> | undefined): void {
        this._onDidChangeTreeDataEmitter.fire(treeItem);
    }

    public async loadMore(treeItem: AzureTreeItem<TRoot | ISubscriptionRoot>): Promise<void> {
        if (treeItem.parent) {
            await treeItem.parent.loadMoreChildren();
            this._onDidChangeTreeDataEmitter.fire(treeItem.parent);
        }
    }

    public async showTreeItemPicker(expectedContextValues: string | (string | RegExp)[] | RegExp, startingTreeItem?: AzureTreeItem<TRoot | ISubscriptionRoot>): Promise<AzureTreeItem<TRoot | ISubscriptionRoot>> {
        if (!Array.isArray(expectedContextValues)) {
            expectedContextValues = [expectedContextValues];
        }

        // tslint:disable-next-line:strict-boolean-expressions
        let treeItem: AzureTreeItem<TRoot | ISubscriptionRoot> = startingTreeItem || await this.promptForRootTreeItem(expectedContextValues);

        while (!expectedContextValues.some((val: string | RegExp) => (val instanceof RegExp && val.test(treeItem.contextValue)) || treeItem.contextValue === val)) {
            // using instanceof AzureParentTreeItem causes issues whenever packages are linked for dev testing.  Any tree item that has loadMoreChildrenImpl should be an AzureParentTreeItem
            if ((<AzureParentTreeItem>treeItem).loadMoreChildrenImpl) {
                treeItem = await (<AzureParentTreeItem>treeItem).pickChildTreeItem(expectedContextValues);
            } else {
                throw new Error(localize('noResourcesError', 'No matching resources found.'));
            }
        }

        return treeItem;
    }

    public async findTreeItem(fullId: string): Promise<AzureTreeItem<TRoot | ISubscriptionRoot> | undefined> {
        let treeItems: AzureTreeItem<TRoot | ISubscriptionRoot>[] = await this.getChildren();
        let foundAncestor: boolean;

        do {
            foundAncestor = false;

            for (const treeItem of treeItems) {
                if (treeItem.fullId === fullId) {
                    return treeItem;
                } else if (fullId.startsWith(`${treeItem.fullId}/`) && treeItem instanceof AzureParentTreeItem) {
                    // Append '/' to 'treeItem.fullId' when checking 'startsWith' to ensure its actually an ancestor, rather than a treeItem at the same level that _happens_ to start with the same id
                    // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
                    treeItems = await treeItem.getCachedChildren();
                    foundAncestor = true;
                    break;
                }
            }
        } while (foundAncestor);

        return undefined;
    }

    public async getParent(element: AzureTreeItem): Promise<AzureTreeItem | undefined> {
        return element.parent;
    }

    public async getSubscriptionPromptStep(wizardContext: Partial<types.ISubscriptionWizardContext>): Promise<types.AzureWizardPromptStep<types.ISubscriptionWizardContext> | undefined> {
        const subscriptions: AzureTreeItem<ISubscriptionRoot>[] = await this.ensureRootTreeItems();
        if (subscriptions.length === 1) {
            assignRootToWizardContext(wizardContext, subscriptions[0].root);
            return undefined;
        } else {
            // tslint:disable-next-line: no-var-self
            const tree: AzureTreeDataProvider<TRoot> = this;
            class SubscriptionPromptStep extends AzureWizardPromptStep<types.ISubscriptionWizardContext> {
                public async prompt(): Promise<void> {
                    const ti: AzureTreeItem<TRoot | ISubscriptionRoot> = await tree.promptForRootTreeItem(SubscriptionTreeItem.contextValue);
                    assignRootToWizardContext(wizardContext, <types.ISubscriptionRoot>ti.root);
                }
                public shouldPrompt(): boolean { return !(<types.ISubscriptionWizardContext>wizardContext).subscriptionId; }
            }
            return new SubscriptionPromptStep();
        }
    }

    private async promptForRootTreeItem(expectedContextValues: string | (string | RegExp)[] | RegExp): Promise<AzureTreeItem<TRoot | ISubscriptionRoot>> {
        let picks: IAzureQuickPickItem<AzureTreeItem<TRoot | ISubscriptionRoot> | string>[];
        const initialStatus: AzureLoginStatus = this._azureAccount.status;
        if (initialStatus === 'LoggedIn') {
            picks = (await this.ensureRootTreeItems()).map((ti: AzureTreeItem<ISubscriptionRoot>) => {
                return {
                    data: ti,
                    label: ti.label,
                    description: ti.root.subscriptionId
                };
            });
        } else if (initialStatus === 'LoggingIn' || initialStatus === 'Initializing') {
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: localize('waitingForAzureSignin', 'Waiting for Azure sign-in')
                },
                async (_progress: vscode.Progress<{ message?: string }>): Promise<void> => {
                    await this._azureAccount.waitForSubscriptions();
                });
            return await this.promptForRootTreeItem(expectedContextValues);
        } else {
            picks = [
                { label: signInLabel, description: '', data: signInCommandId },
                { label: createAccountLabel, description: '', data: createAccountCommandId }
            ];
        }

        const contextValues: (string | RegExp)[] = Array.isArray(expectedContextValues) ? expectedContextValues : [expectedContextValues];
        picks = picks.concat(this._customRootTreeItems
            .filter((ti: AzureTreeItem<TRoot>) => ti.includeInTreePicker(contextValues))
            .map((ti: AzureTreeItem<TRoot>) => { return { data: ti, description: '', label: ti.label }; }));

        const options: QuickPickOptions = { placeHolder: localize('selectSubscription', 'Select a Subscription') };
        const result: AzureTreeItem<TRoot | ISubscriptionRoot> | string = picks.length === 1 ? picks[0].data : (await ext.ui.showQuickPick(picks, options)).data;
        if (typeof result === 'string') {
            await vscode.commands.executeCommand(result);
            await this._azureAccount.waitForFilters();

            if (this._azureAccount.status === 'LoggedIn') {
                await this.ensureRootTreeItems();
                return await this.promptForRootTreeItem(expectedContextValues);
            } else {
                throw new UserCancelledError();
            }
        } else {
            return result;
        }
    }

    private async ensureRootTreeItems(): Promise<AzureTreeItem<ISubscriptionRoot>[]> {
        if (!this._subscriptionTreeItems) {
            await this.getChildren();
        }

        // tslint:disable-next-line:no-non-null-assertion
        return this._subscriptionTreeItems!;
    }

    private async populateRoots(actionContext: IActionContext): Promise<AzureTreeItem<TRoot | ISubscriptionRoot>[]> {
        actionContext.properties.isActivationEvent = 'true';
        actionContext.properties.contextValue = 'root';
        actionContext.properties.accountStatus = this._azureAccount.status;

        let roots: AzureTreeItem<TRoot | ISubscriptionRoot>[];

        const existingSubscriptions: AzureTreeItem<ISubscriptionRoot>[] = this._subscriptionTreeItems ? this._subscriptionTreeItems : [];
        this._subscriptionTreeItems = [];

        let commandLabel: string | undefined;
        if (this._azureAccount.status === 'Initializing' || this._azureAccount.status === 'LoggingIn') {
            roots = [new GenericTreeItem(undefined, {
                label: this._azureAccount.status === 'Initializing' ? localize('loadingTreeItem', 'Loading...') : localize('signingIn', 'Waiting for Azure sign-in...'),
                commandId: signInCommandId,
                contextValue: 'azureCommand',
                id: signInCommandId,
                iconPath: {
                    light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Loading.svg'),
                    dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                }
            })];
        } else if (this._azureAccount.status === 'LoggedOut') {
            roots = [
                new GenericTreeItem(undefined, { label: signInLabel, commandId: signInCommandId, contextValue: 'azureCommand', id: signInCommandId }),
                new GenericTreeItem(undefined, { label: createAccountLabel, commandId: createAccountCommandId, contextValue: 'azureCommand', id: createAccountCommandId })
            ];
        } else if (this._azureAccount.filters.length === 0) {
            commandLabel = localize('noSubscriptions', 'Select Subscriptions...');
            roots = [new GenericTreeItem(undefined, { label: commandLabel, commandId: 'azure-account.selectSubscriptions', contextValue: 'azureCommand', id: 'azure-account.selectSubscriptions' })];
        } else {
            this._subscriptionTreeItems = this._azureAccount.filters.map((filter: AzureResourceFilter) => {
                if (filter.subscription.id === undefined || filter.subscription.displayName === undefined || filter.subscription.subscriptionId === undefined) {
                    throw new ArgumentError(filter);
                } else {
                    const existingTreeItem: AzureTreeItem<ISubscriptionRoot> | undefined = existingSubscriptions.find((ti: AzureTreeItem<ISubscriptionRoot>) => ti.id === filter.subscription.id);
                    if (existingTreeItem) {
                        // Return existing treeItem (which might have many 'cached' tree items underneath it) rather than creating a brand new tree item every time
                        return existingTreeItem;
                    } else {
                        // filter.subscription.id is the The fully qualified ID of the subscription (For example, /subscriptions/00000000-0000-0000-0000-000000000000) and should be used as the tree item's id for the purposes of OpenInPortal
                        // filter.subscription.subscriptionId is just the guid and is used in all other cases when creating clients for managing Azure resources
                        const newItem: SubscriptionTreeItem = new this._subscriptionTreeItemType({
                            credentials: filter.session.credentials,
                            subscriptionDisplayName: filter.subscription.displayName,
                            subscriptionId: filter.subscription.subscriptionId,
                            subscriptionPath: filter.subscription.id,
                            tenantId: filter.session.tenantId,
                            userId: filter.session.userId,
                            environment: filter.session.environment
                        });
                        newItem.treeDataProvider = <IAzureTreeDataProviderInternal<ISubscriptionRoot>>this;
                        return newItem;
                    }
                }
            });
            roots = this._subscriptionTreeItems;
        }

        return roots.concat(this._customRootTreeItems);
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
