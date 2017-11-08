/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Subscription } from 'azure-arm-resource/lib/subscription/models';
import { ServiceClientCredentials } from 'ms-rest';
import * as vscode from 'vscode';
import { AzureAccount } from '../azure-account.api';
import { localize } from '../localize';
import { WizardBase } from '../wizard/WizardBase';
import { AppKind, getAppKindDisplayName, WebsiteOS } from './AppKind';
import { AppServicePlanStep } from './AppServicePlanStep';
import { ResourceGroupStep } from './ResourceGroupStep';
import { SiteNameStep } from './SiteNameStep';
import { SiteStep } from './SiteStep';
import { StorageAccountStep } from './StorageAccountStep';
import { SubscriptionStep } from './SubscriptionStep';

export class AppServiceCreator extends WizardBase {
    public readonly azureAccount: AzureAccount;

    public websiteNameStep: SiteNameStep;
    public subscriptionStep: SubscriptionStep;
    public resourceGroupStep: ResourceGroupStep;
    public appServicePlanStep?: AppServicePlanStep;
    public storageAccountStep?: StorageAccountStep;
    public siteStep: SiteStep;

    private readonly _credentials: ServiceClientCredentials | undefined;
    private readonly _subscription: Subscription | undefined;

    constructor(output: vscode.OutputChannel, persistence: vscode.Memento, appKind: AppKind, websiteOS: WebsiteOS, credentials?: ServiceClientCredentials, subscription?: Subscription) {
        super(output, persistence);
        this._credentials = credentials;
        this._subscription = subscription;

        // Rather than expose 'AzureAccount' types in the index.ts contract, simply get it inside of this npm package
        const azureAccountExtension: vscode.Extension<AzureAccount> | undefined = vscode.extensions.getExtension<AzureAccount>('ms-vscode.azure-account');
        if (!azureAccountExtension) {
            throw new Error(localize('NoAccountExtensionError', 'The Azure Account Extension is required for the App Service tools.'));
        } else {
            this.azureAccount = azureAccountExtension.exports;
        }

        this.subscriptionStep = new SubscriptionStep(this, this.azureAccount, localize('selectSubscription', 'Select the subscription to create the new {0} in.', getAppKindDisplayName(appKind)), this._credentials, this._subscription);
        this.websiteNameStep = new SiteNameStep(this, appKind);
        this.resourceGroupStep = new ResourceGroupStep(this);

        this.steps.push(this.subscriptionStep);
        this.steps.push(this.websiteNameStep);
        this.steps.push(this.resourceGroupStep);

        switch (appKind) {
            case AppKind.functionapp:
                this.storageAccountStep = new StorageAccountStep(this);
                this.steps.push(this.storageAccountStep);
                break;
            case AppKind.app:
            default:
                this.appServicePlanStep = new AppServicePlanStep(this, appKind, websiteOS);
                this.steps.push(this.appServicePlanStep);
        }

        this.siteStep = new SiteStep(this, appKind, websiteOS);
        this.steps.push(this.siteStep);
    }
}
