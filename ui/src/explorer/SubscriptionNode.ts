/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { AzureEnvironment } from 'ms-rest-azure';
import * as path from 'path';
import { AzureExplorer, IChildProvider } from '../../index';
import { AzureSubscription } from '../azure-account.api';
import { AzureParentNode } from './AzureParentNode';

export class SubscriptionNode extends AzureParentNode {
    public static readonly contextValue: string = 'azureSubscription';
    private readonly _subscriptionInfo: AzureSubscription;
    private readonly _explorer: AzureExplorer;

    public constructor(explorer: AzureExplorer, childProvider: IChildProvider, id: string, label: string, subscriptionInfo: AzureSubscription) {
        super(undefined, {
            id: id,
            label: label,
            contextValue: SubscriptionNode.contextValue,
            iconPath: path.join(__filename, '..', '..', '..', 'resources', 'azureSubscription.svg'),
            childTypeLabel: childProvider.childTypeLabel,
            createChild: childProvider.createChild ? <typeof childProvider.createChild>childProvider.createChild.bind(childProvider) : undefined,
            hasMoreChildren: <typeof childProvider.hasMoreChildren>childProvider.hasMoreChildren.bind(childProvider),
            loadMoreChildren: <typeof childProvider.loadMoreChildren>childProvider.loadMoreChildren.bind(childProvider)
        });
        this._explorer = explorer;
        this._subscriptionInfo = subscriptionInfo;
    }

    public get tenantId(): string {
        return this._subscriptionInfo.session.tenantId;
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

    public get explorer(): AzureExplorer {
        return this._explorer;
    }
}
