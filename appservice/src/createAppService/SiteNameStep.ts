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
import { AzureWizardStep, IAzureUserInput } from 'vscode-azureextensionui';
import { uiUtils } from '../utils/uiUtils';
import { getAppKindDisplayName } from './AppKind';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export class SiteNameStep extends AzureWizardStep<IAppServiceWizardContext> {
    public async prompt(wizardContext: IAppServiceWizardContext, ui: IAzureUserInput): Promise<IAppServiceWizardContext> {
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
        const client: WebSiteManagementClient = new WebSiteManagementClient(credentials, subscription.subscriptionId);
        let siteName: string;
        siteName = await ui.showInputBox({
            prompt: `Enter a globally unique name for the new ${getAppKindDisplayName(wizardContext.appKind)}.`,
            validateInput: async (value: string): Promise<string | undefined> => {
                value = value ? value.trim() : '';
                const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(value, 'site');
                if (!nameAvailability.nameAvailable) {
                    return nameAvailability.message;
                }
                return undefined;
            }
        });

        wizardContext.websiteName = siteName;
        wizardContext.relatedNameTask = this.generateRelatedName(wizardContext, siteName);

        return wizardContext;
    }

    public async execute(wizardContext: IAppServiceWizardContext): Promise<IAppServiceWizardContext> {
        return wizardContext;
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
    private async generateRelatedName(wizardContext: IAppServiceWizardContext, siteName: string): Promise<string> {
        const credentials: ServiceClientCredentials = wizardContext.credentials;
        const subscription: Subscription = wizardContext.subscription;
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
