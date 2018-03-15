/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import * as path from 'path';
import { AzureTreeDataProvider, IAzureUserInput, IChildProvider } from '../../index';
import { AzureSubscription } from '../azure-account.api';
import { AzureParentNode } from './AzureParentNode';

export class SubscriptionNode extends AzureParentNode {
    public static readonly contextValue: string = 'azureextensionui.azureSubscription';
    private readonly _subscriptionInfo: AzureSubscription;
    private readonly _treeDataProvider: AzureTreeDataProvider;
    private readonly _ui: IAzureUserInput;

    public constructor(treeDataProvider: AzureTreeDataProvider, ui: IAzureUserInput, childProvider: IChildProvider, id: string, label: string, subscriptionInfo: AzureSubscription) {
        super(undefined, {
            id: `/subscriptions/${id}`,
            label: label,
            contextValue: SubscriptionNode.contextValue,
            iconPath: path.join(__filename, '..', '..', '..', '..', 'resources', 'azureSubscription.svg'),
            childTypeLabel: childProvider.childTypeLabel,
            compareChildren: childProvider.compareChildren,
            createChild: childProvider.createChild ? <typeof childProvider.createChild>childProvider.createChild.bind(childProvider) : undefined,
            hasMoreChildren: <typeof childProvider.hasMoreChildren>childProvider.hasMoreChildren.bind(childProvider),
            loadMoreChildren: <typeof childProvider.loadMoreChildren>childProvider.loadMoreChildren.bind(childProvider)
        });
        this._treeDataProvider = treeDataProvider;
        this._ui = ui;
        this._subscriptionInfo = subscriptionInfo;
    }

    public get tenantId(): string {
        return this._subscriptionInfo.session.tenantId;
    }

    public get userId(): string {
        return this._subscriptionInfo.session.userId;
    }

    public get subscription(): Subscription {
        return this._subscriptionInfo.subscription;
    }

    public get credentials(): ServiceClientCredentials {
        return this._subscriptionInfo.session.credentials;
    }

    public get environment(): AzureEnvironment {
        return this._subscriptionInfo.session.environment;
    }

    public get treeDataProvider(): AzureTreeDataProvider {
        return this._treeDataProvider;
    }

    public get ui(): IAzureUserInput {
        return this._ui;
    }
}
