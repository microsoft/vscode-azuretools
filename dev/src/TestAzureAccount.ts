/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SubscriptionClient, SubscriptionModels } from 'azure-arm-resource';
import { ApplicationTokenCredentials, AzureEnvironment, loginWithServicePrincipalSecret } from 'ms-rest-azure';
import { Event, EventEmitter } from 'vscode';
import * as types from '../index';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter, AzureSession, AzureSubscription } from './@types/azure-account.api';
import { nonNullProp, nonNullValue } from './utils/nonNull';

export class TestAzureAccount implements AzureAccount, types.TestAzureAccount {
    public status: AzureLoginStatus = 'LoggedOut';
    public onStatusChanged: Event<AzureLoginStatus>;
    public sessions: AzureSession[] = [];
    public onSessionsChanged: Event<void>;
    public subscriptions: AzureSubscription[] = [];
    public onSubscriptionsChanged: Event<void>;
    public filters: AzureResourceFilter[] = [];
    public onFiltersChanged: Event<void>;

    private readonly _onStatusChangedEmitter: EventEmitter<AzureLoginStatus>;
    private readonly _onFiltersChangedEmitter: EventEmitter<void>;
    private readonly _onSessionsChangedEmitter: EventEmitter<void>;
    private readonly _onSubscriptionsChangedEmitter: EventEmitter<void>;

    public constructor(vscode: typeof import('vscode')) {
        this._onStatusChangedEmitter = new vscode.EventEmitter<AzureLoginStatus>();
        this.onStatusChanged = this._onStatusChangedEmitter.event;
        this._onFiltersChangedEmitter = new vscode.EventEmitter<void>();
        this.onFiltersChanged = this._onFiltersChangedEmitter.event;
        this._onSessionsChangedEmitter = new vscode.EventEmitter<void>();
        this.onSessionsChanged = this._onSessionsChangedEmitter.event;
        this._onSubscriptionsChangedEmitter = new vscode.EventEmitter<void>();
        this.onSubscriptionsChanged = this._onSubscriptionsChangedEmitter.event;
    }

    public async signIn(): Promise<void> {
        type servicePrincipalCredentials = ApplicationTokenCredentials & { environment: AzureEnvironment };
        const clientId: string | undefined = process.env.SERVICE_PRINCIPAL_CLIENT_ID;
        const secret: string | undefined = process.env.SERVICE_PRINCIPAL_SECRET;
        const domain: string | undefined = process.env.SERVICE_PRINCIPAL_DOMAIN;
        if (!clientId || !secret || !domain) {
            throw new Error('TestAzureAccount cannot be used without the following environment variables: SERVICE_PRINCIPAL_CLIENT_ID, SERVICE_PRINCIPAL_SECRET, SERVICE_PRINCIPAL_DOMAIN');
        }
        this.changeStatus('LoggingIn');
        const credentials: servicePrincipalCredentials = <servicePrincipalCredentials>(await loginWithServicePrincipalSecret(clientId, secret, domain));
        const subscriptionClient: SubscriptionClient = new SubscriptionClient(credentials);
        const subscriptions: SubscriptionModels.SubscriptionListResult = await subscriptionClient.subscriptions.list();
        // returns an array with id, subscriptionId, displayName
        const tenants: SubscriptionModels.TenantListResult = await subscriptionClient.tenants.list();

        const tenantId: string = nonNullProp(nonNullValue(tenants[0]), 'id');
        const session: AzureSession = {
            environment: credentials.environment,
            userId: '',
            tenantId: tenantId,
            credentials: credentials
        };

        const testAzureSubscription: AzureSubscription = { session: session, subscription: nonNullValue(subscriptions[0]) };
        this.subscriptions.push(testAzureSubscription);
        this.changeStatus('LoggedIn');
        this.changeFilter(testAzureSubscription);
    }

    public signOut(): void {
        this.changeStatus('LoggedOut');
        this.changeFilter();
        this.subscriptions = [];
    }

    public getSubscriptionContext(): types.ISubscriptionContext {
        this.verifySubscription();
        const info: AzureSubscription = this.subscriptions[0];
        return {
            credentials: info.session.credentials,
            subscriptionDisplayName: nonNullProp(info.subscription, 'displayName'),
            subscriptionId: nonNullProp(info.subscription, 'subscriptionId'),
            subscriptionPath: nonNullProp(info.subscription, 'id'),
            tenantId: info.session.tenantId,
            userId: info.session.userId,
            environment: info.session.environment
        };
    }

    public async waitForLogin(): Promise<boolean> {
        return true;
    }

    public async waitForSubscriptions(): Promise<boolean> {
        return true;
    }

    public async waitForFilters(): Promise<boolean> {
        return true;
    }

    private changeStatus(newStatus: AzureLoginStatus): void {
        this.status = newStatus;
        this._onStatusChangedEmitter.fire(this.status);
    }

    private changeFilter(newFilter?: AzureResourceFilter): void {
        if (newFilter) {
            this.filters.push(newFilter);
        } else {
            this.filters = [];
        }

        this._onFiltersChangedEmitter.fire();
    }

    private verifySubscription(): void {
        if (this.subscriptions.length === 0) {
            const noSubscription: string = 'No subscription found.  Invoke TestAzureAccount.signIn().';
            throw new Error(noSubscription);
        }
    }
}
