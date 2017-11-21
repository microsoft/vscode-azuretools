/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { Disposable, Event, EventEmitter, Extension, extensions, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from 'vscode';
import { IAzureNode, IChildProvider } from '../../index';
import { AzureAccount, AzureLoginStatus, AzureSubscription } from '../azure-account.api';
import { ArgumentError } from '../errors';
import { IUserInterface, PickWithData } from '../IUserInterface';
import { localize } from '../localize';
import { VSCodeUI } from '../VSCodeUI';
import { AzureNode } from './AzureNode';
import { AzureParentNode } from './AzureParentNode';
import { LoadMoreTreeItem } from './LoadMoreTreeItem';
import { SubscriptionNode } from './SubscriptionNode';

export class AzureTreeDataProvider implements TreeDataProvider<IAzureNode>, Disposable {
    public static readonly subscriptionContextValue: string = SubscriptionNode.contextValue;

    private _onDidChangeTreeDataEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();

    private readonly _loadMoreCommandId: string;
    private _resourceProvider: IChildProvider;
    private _ui: IUserInterface;
    private _azureAccount: AzureAccount;

    private _subscriptionNodes: IAzureNode[] = [];
    private _disposables: Disposable[] = [];

    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, ui: IUserInterface = new VSCodeUI()) {
        this._resourceProvider = resourceProvider;
        this._loadMoreCommandId = loadMoreCommandId;
        this._ui = ui;

        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: Extension<AzureAccount> | undefined = extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is required for the App Service tools.'));
        } else {
            this._azureAccount = azureAccountExtension.exports;
        }

        this._disposables.push(this._azureAccount.onFiltersChanged(() => this.refresh()));
        this._disposables.push(this._azureAccount.onStatusChanged((status: AzureLoginStatus) => {
            // Ignore status change to 'LoggedIn' and wait for the 'onFiltersChanged' event to fire instead
            // (so that the tree stays in 'Loading...' state until the filters are actually ready)
            if (status !== 'LoggedIn') {
                this.refresh();
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
            this._subscriptionNodes = [];

            let commandLabel: string | undefined;
            const loginCommandId: string = 'azure-account.login';
            if (this._azureAccount.status === 'Initializing' || this._azureAccount.status === 'LoggingIn') {
                return [new AzureNode(undefined, {
                    label: localize('loadingNode', 'Loading...'),
                    commandId: loginCommandId,
                    contextValue: 'azureCommandNode',
                    id: loginCommandId,
                    iconPath: {
                        light: path.join(__filename, '..', '..', '..', 'resources', 'light', 'Loading.svg'),
                        dark: path.join(__filename, '..', '..', '..', 'resources', 'dark', 'Loading.svg')
                    }
                })];
            } else if (this._azureAccount.status === 'LoggedOut') {
                return [new AzureNode(undefined, { label: localize('signInNode', 'Sign in to Azure...'), commandId: loginCommandId, contextValue: 'azureCommandNode', id: loginCommandId })];
            } else if (this._azureAccount.filters.length === 0) {
                commandLabel = localize('noSubscriptionsNode', 'No subscriptions found. Edit filters...');
                return [new AzureNode(undefined, { label: commandLabel, commandId: 'azure-account.selectSubscriptions', contextValue: 'azureCommandNode', id: 'azure-account.selectSubscriptions' })];

            } else {
                this._subscriptionNodes = this._azureAccount.filters.map((subscriptionInfo: AzureSubscription) => {
                    if (subscriptionInfo.subscription.subscriptionId === undefined || subscriptionInfo.subscription.displayName === undefined) {
                        throw new ArgumentError(subscriptionInfo);
                    } else {
                        return new SubscriptionNode(this, this._resourceProvider, subscriptionInfo.subscription.subscriptionId, subscriptionInfo.subscription.displayName, subscriptionInfo);
                    }
                });
                return this._subscriptionNodes;
            }
        }
    }

    public refresh(node?: IAzureNode, clearCache: boolean = true): void {
        if (node instanceof AzureParentNode && clearCache) {
            node.clearCache();
        }

        this._onDidChangeTreeDataEmitter.fire(node);
    }

    public async loadMore(node: IAzureNode): Promise<void> {
        if (node.parent instanceof AzureParentNode) {
            await node.parent.loadMoreChildren();
            this._onDidChangeTreeDataEmitter.fire(node.parent);
        }
    }

    public async showNodePicker(expectedContextValue: string): Promise<IAzureNode> {
        const picks: PickWithData<SubscriptionNode>[] = this._subscriptionNodes.map((n: SubscriptionNode) => new PickWithData<SubscriptionNode>(n, n.treeItem.label, n.subscription.subscriptionId));
        let node: AzureNode = (await this._ui.showQuickPick<SubscriptionNode>(picks, localize('selectSubscription', 'Select a Subscription'))).data;

        while (node.treeItem.contextValue !== expectedContextValue) {
            if (node instanceof AzureParentNode) {
                node = await node.pickChildNode(expectedContextValue, this._ui);
            } else {
                throw new Error(localize('noResourcesError', 'No matching resources found.'));
            }
        }

        return node;
    }
}
