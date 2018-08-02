/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { SubscriptionClient } from 'azure-arm-resource';
import { SubscriptionListResult, TenantListResult } from 'azure-arm-resource/lib/subscription/models';
import { ApplicationTokenCredentials, AzureEnvironment, loginWithServicePrincipalSecret } from 'ms-rest-azure';
import { Event, EventEmitter } from 'vscode';
import { AzureAccount, AzureLoginStatus, AzureResourceFilter, AzureSession, AzureSubscription } from './azure-account.api';
import { ArgumentError } from './errors';

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
        this.status = 'Initializing';
        this.onStatusChangedEmitter = new EventEmitter<AzureLoginStatus>();
        this.onStatusChanged = this.onStatusChangedEmitter.event;
        this.onFiltersChangedEmitter = new EventEmitter<void>();
        this.onFiltersChanged = this.onFiltersChangedEmitter.event;
        this.filters = [];
    }

    public async getTestSubscription(): Promise<void> {
        type servicePrincipalCredentials = ApplicationTokenCredentials & { environment: AzureEnvironment };
        // REMOVE ALL OF THIS
        const clientId: string | undefined = '0f533bd7-85c2-4c2e-994a-84631f177a73';
        const secret: string | undefined = 'du44tQEltLOBZ91c5zAeL1isGNNRFfEX4mAJdh4ViVM=';
        const domain: string | undefined = '72f988bf-86f1-41af-91ab-2d7cd011db47';
        if (!clientId || !secret || !domain) {
            throw new Error('Tests can only be run on Travis.');
        }
        this.status = 'LoggingIn';
        const credentials: servicePrincipalCredentials = <servicePrincipalCredentials>(await loginWithServicePrincipalSecret(clientId, secret, domain));
        const subscriptionClient: SubscriptionClient = new SubscriptionClient(credentials);
        const subscriptions: SubscriptionListResult = await subscriptionClient.subscriptions.list();
        // returns an array withy subscriptionId, displayName
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

        if (subscriptions[0].id && subscriptions[0].displayName && subscriptions[0].subscriptionId) {
            const testAzureSubscription: AzureSubscription = { session: session, subscription: subscriptions[0] };
            this.filters.push(testAzureSubscription);
            this.subscriptions.push(testAzureSubscription);
            this.status = 'LoggedIn';
            this.onStatusChangedEmitter.fire(this.status);
            this.onFiltersChangedEmitter.fire();
        } else {
            throw new ArgumentError(subscriptions[0]);
        }
    }
}
