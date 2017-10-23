/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtensionContext, extensions, Disposable } from 'vscode';
import { ServiceClientCredentials } from 'ms-rest';
import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { AzureAccount, AzureSession, AzureLoginStatus } from './azure-account.api';

export class NotSignedInError extends Error { }

export class CredentialError extends Error { }

export class AzureAccountWrapper {
    readonly accountApi: AzureAccount;

    constructor(readonly extensionConext: ExtensionContext) {
        this.accountApi = extensions.getExtension<AzureAccount>('ms-vscode.azure-account')!.exports;
    }

    getAzureSessions(): AzureSession[] {
        const status = this.signInStatus;
        if (status !== 'LoggedIn') {
            throw new NotSignedInError(status)
        }
        return this.accountApi.sessions;
    }

    getCredentialByTenantId(tenantId: string): ServiceClientCredentials {
        const session = this.getAzureSessions().find(s => s.tenantId.toLowerCase() === tenantId.toLowerCase());

        if (session) {
            return session.credentials;
        }

        throw new CredentialError(`Failed to get credential, tenant ${tenantId} not found.`);
    }

    get signInStatus(): AzureLoginStatus {
        return this.accountApi.status;
    }

    getFilteredSubscriptions(): SubscriptionModels.Subscription[] {
        return this.accountApi.filters.map<SubscriptionModels.Subscription>(filter => {
            return {
                id: filter.subscription.id,
                subscriptionId: filter.subscription.subscriptionId,
                tenantId: filter.session.tenantId,
                displayName: filter.subscription.displayName,
                state: filter.subscription.state,
                subscriptionPolicies: filter.subscription.subscriptionPolicies,
                authorizationSource: filter.subscription.authorizationSource
            };
        });
    }

    async getLocationsBySubscription(subscription: SubscriptionModels.Subscription): Promise<SubscriptionModels.Location[]> {
        const credential = this.getCredentialByTenantId(subscription.tenantId);
        const client = new SubscriptionClient(credential);
        const locations = <SubscriptionModels.Location[]>(await client.subscriptions.listLocations(subscription.subscriptionId));
        return locations;
    }

    registerStatusChangedListener(listener: (e: AzureLoginStatus) => any, thisArg: any): Disposable {
        return this.accountApi.onStatusChanged(listener, thisArg, this.extensionConext.subscriptions);
    }

    registerFiltersChangedListener(listener: (e: void) => any, thisArg: any): Disposable {
        return this.accountApi.onFiltersChanged(listener, thisArg, this.extensionConext.subscriptions);
    }
}