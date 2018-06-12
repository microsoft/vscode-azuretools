/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient } from 'azure-arm-resource';
import { SubscriptionListResult, TenantListResult } from 'azure-arm-resource/lib/subscription/models';
import { ApplicationTokenCredentials, AzureEnvironment, loginWithServicePrincipalSecret } from 'ms-rest-azure';
import { Disposable, Event, EventEmitter, TreeItem, TreeItemCollapsibleState } from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { IActionContext, IAzureNode, IAzureParentTreeItem, IAzureTreeDataProvider, IAzureUserInput, IChildProvider } from '../index';
import { AzureSession } from './azure-account.api';
import { callWithTelemetryAndErrorHandling } from './callWithTelemetryAndErrorHandling';
import { ArgumentError } from './errors';
import { localize } from './localize';
import { parseError } from './parseError';
import { AzureNode } from './treeDataProvider/AzureNode';
import { AzureParentNode } from './treeDataProvider/AzureParentNode';
import { LoadMoreTreeItem } from './treeDataProvider/LoadMoreTreeItem';
import { RootNode } from './treeDataProvider/RootNode';
import { SubscriptionNode } from './treeDataProvider/SubscriptionNode';

export class TestAzureTreeDataProvider implements IAzureTreeDataProvider<IAzureNode> {
    public static readonly subscriptionContextValue: string = SubscriptionNode.contextValue;

    private _onDidChangeTreeDataEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();
    private _onNodeCreateEmitter: EventEmitter<IAzureNode> = new EventEmitter<IAzureNode>();

    private readonly _loadMoreCommandId: string;
    private _resourceProvider: IChildProvider;
    private _ui: IAzureUserInput;
    private _customRootNodes: AzureNode[];
    private _telemetryReporter: TelemetryReporter | undefined;

    private _subscriptionNodes: IAzureNode[] = [];
    private _disposables: Disposable[] = [];

    constructor(resourceProvider: IChildProvider, loadMoreCommandId: string, ui: IAzureUserInput, telemetryReporter: TelemetryReporter | undefined, rootTreeItems?: IAzureParentTreeItem[]) {
        this._resourceProvider = resourceProvider;
        this._loadMoreCommandId = loadMoreCommandId;
        this._ui = ui;
        this._telemetryReporter = telemetryReporter;
        this._customRootNodes = rootTreeItems ? rootTreeItems.map((treeItem: IAzureParentTreeItem) => new RootNode(this, ui, treeItem, this._onNodeCreateEmitter)) : [];
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
            const thisTree: TestAzureTreeDataProvider = this;
            return <IAzureNode[]>await callWithTelemetryAndErrorHandling('AzureTreeDataProvider.getChildren', this._telemetryReporter, undefined, async function (this: IActionContext): Promise<IAzureNode[]> {
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
                    result = await thisTree.getRootNodes(actionContext);
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
        let node: IAzureNode = startingNode || this._subscriptionNodes[0]; // automatically just grab the first (test) subscription node
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

    private async getRootNodes(actionContext: IActionContext): Promise<IAzureNode[]> {
        actionContext.properties.isActivationEvent = 'true';
        actionContext.properties.contextValue = 'root';
        let nodes: IAzureNode[];
        this._subscriptionNodes = [];
        type servicePrincipalCredentials = ApplicationTokenCredentials & { environment: AzureEnvironment };
        const clientId: string | undefined = process.env.SERVICE_PRINCIPAL_CLIENT_ID ;
        const secret: string | undefined = process.env.SERVICE_PRINCIPAL_SECRET;
        const domain: string | undefined = process.env.SERVICE_PRINCIPAL_DOMAIN;

        if (!clientId || !secret || !domain) {
            throw new Error('Tests can only be run on Travis.');
        }
        const credentials: servicePrincipalCredentials = <servicePrincipalCredentials>(await loginWithServicePrincipalSecret(clientId, secret, domain));
        const subscriptionClient: SubscriptionClient = new SubscriptionClient(credentials);
        const subscriptions: SubscriptionListResult = await subscriptionClient.subscriptions.list();
        // returns an array with subscriptionId, displayName
        const tenants: TenantListResult = await subscriptionClient.tenants.list();
        // contains tenantId (if I need that)
        let tenantId: string;
        if (tenants[0].id) {
            tenantId = <string>tenants[0].id;
        } else {
            throw new ArgumentError(tenants[0]);
        }

        const session: AzureSession = {
            environment: credentials.environment,
            userId: '',
            tenantId: tenantId,
            credentials: credentials
        };

        let id: string;
        let displayName: string;
        let subscriptionId: string;

        if (subscriptions[0].id && subscriptions[0].displayName && subscriptions[0].subscriptionId) {
            id = <string>subscriptions[0].id;
            displayName = <string>subscriptions[0].displayName;
            subscriptionId = <string>subscriptions[0].subscriptionId;
        } else {
            throw new ArgumentError(subscriptions[0]);
        }

        const testSubscriptionNode: IAzureNode =  new SubscriptionNode(this, this._ui, this._resourceProvider, id, session, displayName, subscriptionId, this._onNodeCreateEmitter);
        this._subscriptionNodes = [testSubscriptionNode];
        nodes = [testSubscriptionNode];
        return nodes;
    }
}
