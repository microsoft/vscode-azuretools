/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceManagementClient } from 'azure-arm-resource';
import { ResourceGroup } from 'azure-arm-resource/lib/resource/models';
import { Subscription } from 'azure-arm-resource/lib/subscription/models';
// tslint:disable-next-line:no-require-imports
import WebSiteManagementClient = require('azure-arm-website');
import { AppServicePlan, ResourceNameAvailability } from 'azure-arm-website/lib/models';
import { ServiceClientCredentials } from 'ms-rest';
import * as vscode from 'vscode';
import { uiUtils } from '../utils/uiUtils';
import { WizardStep } from '../wizard/WizardStep';
import { AppKind, getAppKindDisplayName } from './AppKind';
import { AppServiceCreator } from './AppServiceCreator';

export class SiteNameStep extends WizardStep {
    protected readonly wizard: AppServiceCreator;

    private _websiteName: string;
    private _computeRelatedNamePromise: Promise<string>;
    private readonly _appKind: AppKind;

    constructor(wizard: AppServiceCreator, appKind: AppKind) {
        super(wizard);
        this._appKind = appKind;
    }

    public async prompt(): Promise<void> {
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const client: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        let siteName: string;
        let siteNameOkay: boolean = false;

        while (!siteNameOkay) {
            siteName = await this.showInputBox({
                prompt: `Enter a globally unique name for the new ${getAppKindDisplayName(this._appKind)}. (${this.stepProgressText})`,
                validateInput: (value: string): string | undefined => {
                    value = value ? value.trim() : '';

                    if (!value.match(/^[a-z0-9\-]{1,60}$/ig)) {
                        return 'Name should be 1-60 characters long and can only include alphanumeric characters and hyphens.';
                    }

                    return undefined;
                }
            });
            siteName = siteName.trim();

            // Check if the name has already been taken...
            const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(siteName, 'site');
            siteNameOkay = nameAvailability.nameAvailable;

            if (!siteNameOkay) {
                await vscode.window.showWarningMessage(nameAvailability.message);
            }
        }

        this._websiteName = siteName;
        this._computeRelatedNamePromise = this.generateRelatedName(siteName);
    }

    // tslint:disable-next-line:no-empty
    public async execute(): Promise<void> {
    }

    public get websiteName(): string {
        return this._websiteName;
    }

    public async computeRelatedName(): Promise<string> {
        return await this._computeRelatedNamePromise;
    }

    protected async isNameAvailable(name: string, resourceGroups: ResourceGroup[], appServicePlans: AppServicePlan[]): Promise<boolean> {
        if (resourceGroups.findIndex((rg: ResourceGroup) => rg.name.toLowerCase() === name.toLowerCase()) >= 0) {
            return false;
        }

        if (appServicePlans.findIndex((asp: AppServicePlan) => asp.name.toLowerCase() === name.toLowerCase()) >= 0) {
            return false;
        }

        return true;
    }

    /**
     * Get a suggested base name for resources related to a given site name
     * @param siteName Site name
     */
    private async generateRelatedName(siteName: string): Promise<string> {
        const credentials: ServiceClientCredentials = this.wizard.subscriptionStep.credentials;
        const subscription: Subscription = this.wizard.subscriptionStep.subscription;
        const resourceClient: ResourceManagementClient = new ResourceManagementClient(credentials, subscription.subscriptionId);
        const webSiteClient: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);

        const resourceGroupsTask: Promise<ResourceGroup[]> = uiUtils.listAll(resourceClient.resourceGroups, resourceClient.resourceGroups.list());
        const plansTask: Promise<AppServicePlan[]> = uiUtils.listAll(webSiteClient.appServicePlans, webSiteClient.appServicePlans.list());

        const [groups, plans]: [ResourceGroup[], AppServicePlan[]] = await Promise.all([resourceGroupsTask, plansTask]);

        // Website names are limited to 60 characters, resource group names to 90, storage accounts to 24
        // Storage accounts cannot have uppercase letters or hyphens and at least 3 characters.
        // So restrict everything to: 3-24 charcters, lowercase and digits only.
        const minLength: number = 3;
        const maxLength: number = 24;

        const preferredName: string = siteName.toLowerCase().replace(/[^0-9a-z]/g, '');

        function generateSuffixedName(i: number): string {
            const suffix: string = `${i}`;
            const minUnsuffixedLength: number = minLength - suffix.length;
            const maxUnsuffixedLength: number = maxLength - suffix.length;
            const unsuffixedName: string = preferredName.slice(0, maxUnsuffixedLength) + 'zzz'.slice(0, Math.max(0, minUnsuffixedLength - preferredName.length));
            return unsuffixedName + suffix;
        }

        if (await this.isNameAvailable(preferredName, groups, plans)) {
            return preferredName;
        }

        let count: number = 2;
        let isAvailable: boolean = false;
        let newName: string;
        while (!isAvailable) {
            newName = generateSuffixedName(count);
            isAvailable = await this.isNameAvailable(newName, groups, plans);
            count += 1;
        }

        return newName;
    }
}
