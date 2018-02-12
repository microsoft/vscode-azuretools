/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Disposable, Event, EventEmitter, Extension, extensions, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IAzureNode, IAzureParentTreeItem, IChildProvider } from '../../index';
import { AzureAccount, AzureLoginStatus, AzureSubscription } from '../azure-account.api';
import { ArgumentError } from '../errors';
import { IUserInterface, PickWithData } from '../IUserInterface';
import { localize } from '../localize';
import { VSCodeUI } from '../VSCodeUI';
import { AzureNode } from './AzureNode';
import { AzureParentNode } from './AzureParentNode';
import { LoadMoreTreeItem } from './LoadMoreTreeItem';
import { RootNode } from './RootNode';
import { SubscriptionNode } from './SubscriptionNode';

export class AzureTreeDataProvider implements TreeDataProvider<IAzureNode>, Disposable {
    public static readonly subscriptionContextValue: string = SubscriptionNode.contextValue;

    private _onDidChangeTreeDataEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();

    private readonly _loadMoreCommandId: string;
    private _resourceProvider: IChildProvider;
    private _ui: IUserInterface;
    private _azureAccount: AzureAccount;
    private _rootNodes: AzureNode[];

    private _subscriptionNodes: IAzureNode[] = [];
    private _disposables: Disposable[] = [];

    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, rootTreeItems?: IAzureParentTreeItem[], ui: IUserInterface = new VSCodeUI()) {
        this._resourceProvider = resourceProvider;
        this._loadMoreCommandId = loadMoreCommandId;
        this._rootNodes = rootTreeItems ? rootTreeItems.map((treeItem: IAzureParentTreeItem) => new RootNode(this, treeItem)) : [];
        this._ui = ui;

        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: Extension<AzureAccount> | undefined = extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is required for the App Service tools.'));
        } else {
            this._azureAccount = azureAccountExtension.exports;
        }

        this._disposables.push(this._azureAccount.onFiltersChanged(async () => await this.refresh()));
        this._disposables.push(this._azureAccount.onStatusChanged(async (status: AzureLoginStatus) => {
            // Ignore status change to 'LoggedIn' and wait for the 'onFiltersChanged' event to fire instead
            // (so that the tree stays in 'Loading...' state until the filters are actually ready)
            if (status !== 'LoggedIn') {
                await this.refresh();
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

    public getTreeItem(node: IAzureNode): TreeItem {
        return {
            label: node.treeItem.label,
            id: node.treeItem.id,
            collapsibleState: node instanceof AzureParentNode ? TreeItemCollapsibleState.Collapsed : undefined,
            contextValue: node.treeItem.contextValue,
            iconPath: node.treeItem.iconPath,
            command: node.treeItem.commandId ? {
                command: node.treeItem.commandId,
                title: '',
                arguments: [node]
            } : undefined
        };
    }

    public async getChildren(node?: AzureParentNode): Promise<IAzureNode[]> {
        if (node !== undefined) {
            return node.creatingNodes
                .concat(await node.getCachedChildren())
                .concat(node.treeItem.hasMoreChildren() ? new AzureNode(node, new LoadMoreTreeItem(this._loadMoreCommandId)) : []);
        } else { // Root of tree
            let nodes: IAzureNode[];

            this._subscriptionNodes = [];

            let commandLabel: string | undefined;
            const loginCommandId: string = 'azure-account.login';
            const createCommandId: string = 'azure-account.createAccount';
            if (this._azureAccount.status === 'Initializing' || this._azureAccount.status === 'LoggingIn') {
                nodes = [new AzureNode(undefined, {
                    label: localize('loadingNode', 'Loading...'),
                    commandId: loginCommandId,
                    contextValue: 'azureCommandNode',
                    id: loginCommandId,
                    iconPath: {
                        light: path.join(__filename, '..', '..', '..', '..', 'resources', 'light', 'Loading.svg'),
                        dark: path.join(__filename, '..', '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                    }
                })];
            } else if (this._azureAccount.status === 'LoggedOut') {
                nodes = [
                    new AzureNode(undefined, { label: localize('signInNode', 'Sign in to Azure...'), commandId: loginCommandId, contextValue: 'azureCommandNode', id: loginCommandId }),
                    new AzureNode(undefined, { label: localize('createNode', 'Create a Free Azure Account...'), commandId: createCommandId, contextValue: 'azureCommandNode', id: createCommandId })
                ];
            } else if (this._azureAccount.filters.length === 0) {
                commandLabel = localize('noSubscriptionsNode', 'No subscriptions found. Edit filters...');
                nodes = [new AzureNode(undefined, { label: commandLabel, commandId: 'azure-account.selectSubscriptions', contextValue: 'azureCommandNode', id: 'azure-account.selectSubscriptions' })];
            } else {
                this._subscriptionNodes = this._azureAccount.filters.map((subscriptionInfo: AzureSubscription) => {
                    if (subscriptionInfo.subscription.subscriptionId === undefined || subscriptionInfo.subscription.displayName === undefined) {
                        throw new ArgumentError(subscriptionInfo);
                    } else {
                        return new SubscriptionNode(this, this._resourceProvider, subscriptionInfo.subscription.subscriptionId, subscriptionInfo.subscription.displayName, subscriptionInfo);
                    }
                });
                nodes = this._subscriptionNodes;
            }

            return nodes.concat(this._rootNodes);
        }
    }

    public async refresh(node?: IAzureNode, clearCache: boolean = true): Promise<void> {
        if (clearCache) {
            if (node && node.treeItem.refreshLabel) {
                await node.treeItem.refreshLabel(node);
            }

            if (node instanceof AzureParentNode) {
                node.clearCache();
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

        let node: IAzureNode;
        if (startingNode) {
            node = startingNode;
        } else {
            let picks: PickWithData<IAzureNode>[] = this._subscriptionNodes.map((n: SubscriptionNode) => new PickWithData(n, n.treeItem.label, n.subscription.subscriptionId));
            picks = picks.concat(this._rootNodes.filter((n: AzureNode) => n.includeInNodePicker(<string[]>expectedContextValues)).map((n: AzureNode) => new PickWithData(n, n.treeItem.label)));
            node = (await this._ui.showQuickPick<IAzureNode>(picks, localize('selectSubscription', 'Select a Subscription'), true /* ignoreFocusOut */)).data;
        }

        while (!expectedContextValues.some((val: string) => node.treeItem.contextValue === val)) {
            if (node instanceof AzureParentNode) {
                node = await node.pickChildNode(expectedContextValues, this._ui);
            } else {
                throw new Error(localize('noResourcesError', 'No matching resources found.'));
            }
        }

        return node;
    }
}
