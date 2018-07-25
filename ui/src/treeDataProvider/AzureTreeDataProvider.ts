/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { Disposable, Event, EventEmitter, Extension, extensions, QuickPickOptions, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IActionContext, IAzureNode, IAzureParentTreeItem, IAzureQuickPickItem, IAzureTreeItem, IChildProvider } from '../../index';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter } from '../azure-account.api';
import { callWithTelemetryAndErrorHandling } from '../callWithTelemetryAndErrorHandling';
import { ArgumentError, UserCancelledError } from '../errors';
import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { parseError } from '../parseError';
import { TestAzureAccount } from '../TestAzureAccount';
import { AzureNode } from './AzureNode';
import { AzureParentNode } from './AzureParentNode';
import { LoadMoreTreeItem } from './LoadMoreTreeItem';
import { RootNode } from './RootNode';
import { SubscriptionNode } from './SubscriptionNode';

const signInLabel: string = localize('signInLabel', 'Sign in to Azure...');
const createAccountLabel: string = localize('createAccountLabel', 'Create a Free Azure Account...');
const signInCommandId: string = 'azure-account.login';
const createAccountCommandId: string = 'azure-account.createAccount';

export class AzureTreeDataProvider implements TreeDataProvider<IAzureNode>, Disposable {
    public static readonly subscriptionContextValue: string = SubscriptionNode.contextValue;

    private _onDidChangeTreeDataEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();
    private _onNodeCreateEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();

    private readonly _loadMoreCommandId: string;
    private _resourceProvider: IChildProvider;
    private _azureAccount: AzureAccount;
    private _customRootNodes: AzureNode[];

    private _subscriptionNodes: IAzureNode[] | undefined;

    private _disposables: Disposable[] = [];

    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, rootTreeItems?: IAzureParentTreeItem[], testAccount: boolean = false) {
        this._resourceProvider = resourceProvider;
        this._loadMoreCommandId = loadMoreCommandId;
        this._customRootNodes = rootTreeItems ? rootTreeItems.map((treeItem: IAzureParentTreeItem) => new RootNode(this, treeItem, this._onNodeCreateEmitter)) : [];

        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: Extension<AzureAccount> | undefined = extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (testAccount) {
            this._azureAccount = new TestAzureAccount();
        } else if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is required for the App Service tools.'));
        } else {
            this._azureAccount = azureAccountExtension.exports;
        }

        this._disposables.push(this._azureAccount.onFiltersChanged(async () => await this.refresh(undefined, false)));
        this._disposables.push(this._azureAccount.onStatusChanged(async (status: AzureLoginStatus) => {
            // Ignore status change to 'LoggedIn' and wait for the 'onFiltersChanged' event to fire instead
            // (so that the tree stays in 'Loading...' state until the filters are actually ready)
            if (status !== 'LoggedIn') {
                await this.refresh(undefined, false);
            }
        }));
    }

    public dispose(): void {
        for (const disposable of this._disposables) {
            disposable.dispose();
        }
    }

    public get onDidChangeTreeData(): Event<IAzureNode> {
        return this._onDidChangeTreeDataEmitter.event;
    }

    public get onNodeCreate(): Event<IAzureNode> {
        return this._onNodeCreateEmitter.event;
    }

    public getTreeItem(node: AzureNode): TreeItem {
        return {
            label: node.label,
            id: node.id,
            collapsibleState: node instanceof AzureParentNode ? TreeItemCollapsibleState.Collapsed : undefined,
            contextValue: node.treeItem.contextValue,
            iconPath: node.iconPath,
            command: node.treeItem.commandId ? {
                command: node.treeItem.commandId,
                title: '',
                arguments: [node]
            } : undefined
        };
    }

    public async getChildren(node?: AzureParentNode): Promise<IAzureNode[]> {
        try {
            // tslint:disable:no-var-self
            const thisTree: AzureTreeDataProvider = this;
            return <IAzureNode[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', async function (this: IActionContext): Promise<IAzureNode[]> {
                const actionContext: IActionContext = this;
                // tslint:enable:no-var-self
                actionContext.suppressErrorDisplay = true;
                actionContext.rethrowError = true;
                let result: IAzureNode[];

                if (node !== undefined) {
                    actionContext.properties.contextValue = node.treeItem.contextValue;

                    const cachedChildren: AzureNode[] = await node.getCachedChildren();
                    const hasMoreChildren: boolean = node.treeItem.hasMoreChildren();
                    actionContext.properties.hasMoreChildren = String(hasMoreChildren);

                    result = node.creatingNodes.concat(cachedChildren);
                    if (hasMoreChildren) {
                        result = result.concat(new AzureNode(node, new LoadMoreTreeItem(thisTree._loadMoreCommandId)));
                    }
                } else { // Root of tree
                    result = await thisTree.populateRootNodes(actionContext);
                }

                this.measurements.childCount = result.length;
                return result;
            });
        } catch (error) {
            return [new AzureNode(node, {
                label: localize('errorNode', 'Error: {0}', parseError(error).message),
                contextValue: 'azureextensionui.error'
            })];
        }
    }

    public async refresh(node?: IAzureNode, clearCache: boolean = true): Promise<void> {
        if (clearCache) {
            if (!node) {
                this._subscriptionNodes = [];
                this._customRootNodes.forEach((rootNode: AzureNode) => {
                    if (rootNode instanceof AzureParentNode) {
                        rootNode.clearCache();
                    }
                });
            } else {
                if (node.treeItem.refreshLabel) {
                    await node.treeItem.refreshLabel(node);
                }

                if (node instanceof AzureParentNode) {
                    node.clearCache();
                }
            }
        }

        this._onDidChangeTreeDataEmitter.fire(node);
    }

    public async loadMore(node: IAzureNode): Promise<void> {
        if (node.parent instanceof AzureParentNode) {
            await node.parent.loadMoreChildren();
            this._onDidChangeTreeDataEmitter.fire(node.parent);
        }
    }

    public async showNodePicker(expectedContextValues: string | string[], startingNode?: IAzureNode): Promise<IAzureNode> {
        if (!Array.isArray(expectedContextValues)) {
            expectedContextValues = [expectedContextValues];
        }

        // tslint:disable-next-line:strict-boolean-expressions
        let node: IAzureNode = startingNode || await this.promptForRootNode(expectedContextValues);
        while (!expectedContextValues.some((val: string) => node.treeItem.contextValue === val)) {
            if (node instanceof AzureParentNode) {
                node = await node.pickChildNode(expectedContextValues);
            } else {
                throw new Error(localize('noResourcesError', 'No matching resources found.'));
            }
        }

        return node;
    }

    public async findNode(id: string): Promise<IAzureNode | undefined> {
        let nodes: IAzureNode[] = await this.getChildren();
        let foundAncestor: boolean;

        do {
            foundAncestor = false;

            for (const node of nodes) {
                if (node.id === id) {
                    return node;
                } else if (id.startsWith(`${node.id}/`) && node instanceof AzureParentNode) {
                    // Append '/' to 'node.id' when checking 'startsWith' to ensure its actually an ancestor, rather than a node at the same level that _happens_ to start with the same id
                    // For example, two databases named 'test' and 'test1' as described in this issue: https://github.com/Microsoft/vscode-cosmosdb/issues/488
                    nodes = await node.getCachedChildren();
                    foundAncestor = true;
                    break;
                }
            }
        } while (foundAncestor);

        return undefined;
    }

    private async promptForRootNode(expectedContextValues: string | string[]): Promise<IAzureNode> {
        let picks: IAzureQuickPickItem<AzureNode | string>[];
        const initialStatus: AzureLoginStatus = this._azureAccount.status;
        if (initialStatus === 'LoggedIn') {
            picks = (await this.ensureRootNodes()).map((n: SubscriptionNode) => {
                return {
                    data: n,
                    label: n.treeItem.label,
                    description: n.subscriptionId
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
            return await this.promptForRootNode(expectedContextValues);
        } else {
            picks = [
                { label: signInLabel, description: '', data: signInCommandId },
                { label: createAccountLabel, description: '', data: createAccountCommandId }
            ];
        }

        picks = picks.concat(this._customRootNodes
            .filter((n: AzureNode) => n.includeInNodePicker(<string[]>expectedContextValues))
            .map((n: AzureNode) => { return { data: n, description: '', label: n.treeItem.label }; }));

        const options: QuickPickOptions = { placeHolder: localize('selectSubscription', 'Select a Subscription') };
        const result: AzureNode | string = picks.length === 1 ? picks[0].data : (await ext.ui.showQuickPick(picks, options)).data;
        if (typeof result === 'string') {
            await vscode.commands.executeCommand(result);
            await this._azureAccount.waitForFilters();

            if (this._azureAccount.status === 'LoggedIn') {
                await this.ensureRootNodes();
                return await this.promptForRootNode(expectedContextValues);
            } else {
                throw new UserCancelledError();
            }
        } else {
            return result;
        }
    }

    private async ensureRootNodes(): Promise<IAzureNode<IAzureTreeItem>[]> {
        if (!this._subscriptionNodes) {
            await this.getChildren();
        }

        // tslint:disable-next-line:no-non-null-assertion
        return this._subscriptionNodes!;
    }

    private async populateRootNodes(actionContext: IActionContext): Promise<IAzureNode[]> {
        actionContext.properties.isActivationEvent = 'true';
        actionContext.properties.contextValue = 'root';
        actionContext.properties.accountStatus = this._azureAccount.status;

        let nodes: IAzureNode[];

        const existingSubscriptionNodes: IAzureNode[] = this._subscriptionNodes ? this._subscriptionNodes : [];
        this._subscriptionNodes = [];

        let commandLabel: string | undefined;
        if (this._azureAccount.status === 'Initializing' || this._azureAccount.status === 'LoggingIn') {
            nodes = [new AzureNode(undefined, {
                label: this._azureAccount.status === 'Initializing' ? localize('loadingNode', 'Loading...') : localize('signingIn', 'Waiting for Azure sign-in...'),
                commandId: signInCommandId,
                contextValue: 'azureCommandNode',
                id: signInCommandId,
                iconPath: {
                    light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Loading.svg'),
                    dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                }
            })];
        } else if (this._azureAccount.status === 'LoggedOut') {
            nodes = [
                new AzureNode(undefined, { label: signInLabel, commandId: signInCommandId, contextValue: 'azureCommandNode', id: signInCommandId }),
                new AzureNode(undefined, { label: createAccountLabel, commandId: createAccountCommandId, contextValue: 'azureCommandNode', id: createAccountCommandId })
            ];
        } else if (this._azureAccount.filters.length === 0) {
            commandLabel = localize('noSubscriptionsNode', 'Select Subscriptions...');
            nodes = [new AzureNode(undefined, { label: commandLabel, commandId: 'azure-account.selectSubscriptions', contextValue: 'azureCommandNode', id: 'azure-account.selectSubscriptions' })];
        } else {
            this._subscriptionNodes = this._azureAccount.filters.map((filter: AzureResourceFilter) => {
                if (filter.subscription.id === undefined || filter.subscription.displayName === undefined || filter.subscription.subscriptionId === undefined) {
                    throw new ArgumentError(filter);
                } else {
                    const existingNode: IAzureNode | undefined = existingSubscriptionNodes.find((node: SubscriptionNode) => node.id === filter.subscription.id);
                    if (existingNode) {
                        // Return existing node (which might have many 'cached' nodes underneath it) rather than creating a brand new node every time
                        return existingNode;
                    } else {
                        // filter.subscription.id is the The fully qualified ID of the subscription (For example, /subscriptions/00000000-0000-0000-0000-000000000000) and should be used as the node's id for the purposes of OpenInPortal
                        // filter.subscription.subscriptionId is just the guid and is used in all other cases when creating clients for managing Azure resources
                        return new SubscriptionNode(this, this._resourceProvider, filter.subscription.id, filter.session, filter.subscription.displayName, filter.subscription.subscriptionId, this._onNodeCreateEmitter);
                    }
                }
            });
            nodes = this._subscriptionNodes;
        }

        return nodes.concat(this._customRootNodes);
    }
}
