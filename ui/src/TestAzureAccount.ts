/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscriptionClient } from 'azure-arm-resource';
import { SubscriptionListResult, TenantListResult } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import { ApplicationTokenCredentials, AzureEnvironment, loginWithServicePrincipalSecret } from 'ms-rest-azure';
import { Event, EventEmitter } from 'vscode';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter, AzureSession, AzureSubscription } from './azure-account.api';
import { ArgumentError } from './errors';
import { localize } from './localize';

export class TestAzureAccount implements AzureAccount {
    public status: AzureLoginStatus;
    public onStatusChanged: Event<AzureLoginStatus>;
    public waitForLogin: () => Promise<boolean>;
    public sessions: AzureSession[];
    public onSessionsChanged: Event<void>;
    public subscriptions: AzureSubscription[];
    public onSubscriptionsChanged: Event<void>;
    public waitForSubscriptions: () => Promise<boolean>;
    public filters: AzureResourceFilter[];
    public onFiltersChanged: Event<void>;
    public waitForFilters: () => Promise<boolean>;
    private onStatusChangedEmitter: EventEmitter<AzureLoginStatus>;
    private onFiltersChangedEmitter: EventEmitter<void>;

    public constructor() {
        this.subscriptions = [];
        this.status = 'LoggedOut';
        this.onStatusChangedEmitter = new EventEmitter<AzureLoginStatus>();
        this.onStatusChanged = this.onStatusChangedEmitter.event;
        this.onFiltersChangedEmitter = new EventEmitter<void>();
        this.onFiltersChanged = this.onFiltersChangedEmitter.event;
        this.filters = [];
    }

    public async signIn(): Promise<void> {
        type servicePrincipalCredentials = ApplicationTokenCredentials & { environment: AzureEnvironment };
        const clientId: string | undefined = process.env.SERVICE_PRINCIPAL_CLIENT_ID;
        const secret: string | undefined = process.env.SERVICE_PRINCIPAL_SECRET;
        const domain: string | undefined = process.env.SERVICE_PRINCIPAL_DOMAIN;
        if (!clientId || !secret || !domain) {
            throw new Error(localize('travisOnly', 'TestAzureAccount cannot be used without the following environment variables: SERVICE_PRINCIPAL_CLIENT_ID, SERVICE_PRINCIPAL_SECRET, SERVICE_PRINCIPAL_DOMAIN'));
        }
        this.changeStatus('LoggingIn');
        const credentials: servicePrincipalCredentials = <servicePrincipalCredentials>(await loginWithServicePrincipalSecret(clientId, secret, domain));
        const subscriptionClient: SubscriptionClient = new SubscriptionClient(credentials);
        const subscriptions: SubscriptionListResult = await subscriptionClient.subscriptions.list();
        // returns an array withy subscriptionId, displayName
        const tenants: TenantListResult = await subscriptionClient.tenants.list();

        if (tenants[0].id) {
            const tenantId: string = <string>tenants[0].id;
            const session: AzureSession = {
                environment: credentials.environment,
                userId: '',
                tenantId: tenantId,
                credentials: credentials
            };

            if (subscriptions[0].id && subscriptions[0].displayName && subscriptions[0].subscriptionId) {
                const testAzureSubscription: AzureSubscription = { session: session, subscription: subscriptions[0] };
                this.subscriptions.push(testAzureSubscription);
                this.changeStatus('LoggedIn');
                this.changeFilter(testAzureSubscription);
            } else {
                throw new ArgumentError(subscriptions[0]);
            }
        } else {
            throw new ArgumentError(tenants[0]);
        }
    }

    public signOut(): void {
        this.changeStatus('LoggedOut');
        this.changeFilter();
        this.subscriptions = [];
    }

    public getSubscriptionCredentials(): ServiceClientCredentials {
        this.verifySubscription();
        return this.subscriptions[0].session.credentials;
    }

    public getSubscriptionId(): string {
        this.verifySubscription();
        if (this.subscriptions[0].subscription.id) {
            // tslint:disable-next-line:no-non-null-assertion
            return this.subscriptions[0].subscription.id!;
        } else {
            throw new ArgumentError(this.subscriptions[0].subscription);

        }
    }

    private changeStatus(newStatus: AzureLoginStatus): void {
        this.status = newStatus;
        this.onStatusChangedEmitter.fire(this.status);
    }

    private changeFilter(newFilter?: AzureResourceFilter): void {
        if (newFilter) {
            this.filters.push(newFilter);
        } else {
            this.filters = [];
        }

        this.onFiltersChangedEmitter.fire();
    }

    private verifySubscription(): void {
        if (this.subscriptions.length === 0) {
            const noSubscription: string = localize('noSubscription', 'No subscription found.  Invoke TestAzureAccount.signIn().');
            throw new Error(noSubscription);
        }
    }
}
