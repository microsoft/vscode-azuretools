/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceNameAvailability } from '@azure/arm-appservice';
import { ServiceClient } from '@azure/ms-rest-js';
import { createGenericClient, ResourceGroupListStep, resourceGroupNamingRules, StorageAccountListStep, storageAccountNamingRules } from '@microsoft/vscode-azext-azureutils';
import { AzureNameStep, IAzureNamingRules } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { checkNameAvailability } from '../utils/azureUtils';
import { appInsightsNamingRules } from './AppInsightsListStep';
import { AppKind } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { appServicePlanNamingRules } from './AppServicePlanNameStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

const siteNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 60,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

export class SiteNameStep extends AzureNameStep<IAppServiceWizardContext> {
    public async prompt(context: IAppServiceWizardContext): Promise<void> {
        const client = await createGenericClient(context, context);

        let placeHolder: string | undefined;
        if (context.environment.name === 'Azure') {
            // Unfortunately, the environment object doesn't have the url we need for this placeholder. Might be fixed in the new sdk: https://github.com/microsoft/vscode-azuretools/issues/510
            // For now, we'll only display this placeholder for the most common case
            let namePlaceholder: string;
            if (context.newSiteKind === AppKind.functionapp) {
                namePlaceholder = vscode.l10n.t('function app name');
            } else if (context.newSiteKind?.includes(AppKind.workflowapp)) {
                namePlaceholder = vscode.l10n.t('logic app name');
            } else {
                namePlaceholder = vscode.l10n.t('web app name');
            }
            placeHolder = `<${namePlaceholder}>.azurewebsites.net`;
        }

        let prompt: string;
        if (context.newSiteKind === AppKind.functionapp) {
            prompt = vscode.l10n.t('Enter a globally unique name for the new function app.');
        } else if (context.newSiteKind?.includes(AppKind.workflowapp)) {
            prompt = vscode.l10n.t('Enter a globally unique name for the new logic app.');
        } else {
            prompt = vscode.l10n.t('Enter a globally unique name for the new web app.');
        }

        context.newSiteName = (await context.ui.showInputBox({
            prompt,
            placeHolder,
            validateInput: async (name: string): Promise<string | undefined> => await this.validateSiteName(client, name, context.subscriptionId)
        })).trim();
        context.valuesToMask.push(context.newSiteName);

        const namingRules: IAzureNamingRules[] = [resourceGroupNamingRules];
        if (context.newSiteKind === AppKind.functionapp) {
            namingRules.push(storageAccountNamingRules);
        } else {
            namingRules.push(appServicePlanNamingRules);
        }

        namingRules.push(appInsightsNamingRules);
        context.relatedNameTask = this.generateRelatedName(context, context.newSiteName, namingRules);
    }

    public async getRelatedName(context: IAppServiceWizardContext, name: string): Promise<string | undefined> {
        return await this.generateRelatedName(context, name, appServicePlanNamingRules);
    }

    public shouldPrompt(context: IAppServiceWizardContext): boolean {
        return !context.newSiteName;
    }

    protected async isRelatedNameAvailable(context: IAppServiceWizardContext, name: string): Promise<boolean> {
        const tasks: Promise<boolean>[] = [ResourceGroupListStep.isNameAvailable(context, name)];
        if (context.newSiteKind === AppKind.functionapp) {
            tasks.push(StorageAccountListStep.isNameAvailable(context, name));
        } else {
            tasks.push(AppServicePlanListStep.isNameAvailable(context, name, name));
        }

        return (await Promise.all(tasks)).every((v: boolean) => v);
    }

    private async validateSiteName(client: ServiceClient, name: string, subscriptionId: string): Promise<string | undefined> {
        name = name.trim();

        if (name.length < siteNamingRules.minLength || name.length > siteNamingRules.maxLength) {
            return vscode.l10n.t('The name must be between {0} and {1} characters.', siteNamingRules.minLength, siteNamingRules.maxLength);
        } else if (siteNamingRules.invalidCharsRegExp.test(name)) {
            return vscode.l10n.t("The name can only contain letters, numbers, or hyphens.");
        } else {
            const nameAvailability: ResourceNameAvailability = await checkNameAvailability(client, subscriptionId, name, 'Site');
            if (!nameAvailability.nameAvailable) {
                return nameAvailability.message;
            } else {
                return undefined;
            }
        }
    }
}
