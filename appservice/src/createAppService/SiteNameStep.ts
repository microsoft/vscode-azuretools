/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ResourceNameAvailability, Site, WebSiteManagementClient } from '@azure/arm-appservice';
import { createHttpHeaders, createPipelineRequest } from '@azure/core-rest-pipeline';
import { AzExtLocation, AzExtPipelineResponse, AzExtRequestPrepareOptions, LocationListStep, ResourceGroupListStep, StorageAccountListStep, createGenericClient, resourceGroupNamingRules, storageAccountNamingRules } from '@microsoft/vscode-azext-azureutils';
import { AgentInputBoxOptions, AzureNameStep, IAzureAgentInput, IAzureNamingRules, nonNullValue, nonNullValueAndProp } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { createWebSiteClient } from '../utils/azureClients';
import { appInsightsNamingRules } from './AppInsightsListStep';
import { AppKind } from './AppKind';
import { AppServicePlanListStep } from './AppServicePlanListStep';
import { appServicePlanNamingRules } from './AppServicePlanNameStep';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';
import { DomainNameLabelScope } from './SiteDomainNameLabelScopeStep';

interface SiteNameStepWizardContext extends IAppServiceWizardContext {
    ui: IAzureAgentInput;
}

const siteNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 60,
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

export class SiteNameStep extends AzureNameStep<SiteNameStepWizardContext> {
    private _siteFor: "functionApp" | "containerizedFunctionApp" | undefined;

    constructor(siteFor?: "functionApp" | "containerizedFunctionApp" | undefined) {
        super();
        this._siteFor = siteFor;
    }

    public async prompt(context: SiteNameStepWizardContext): Promise<void> {
        const client = await createWebSiteClient(context);

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
            prompt = vscode.l10n.t('Enter a name for the new web app.');
        }

        const agentMetadata = this._siteFor === ("functionApp") || this._siteFor === ("containerizedFunctionApp") ?
            { parameterDisplayTitle: vscode.l10n.t('Function App Name'), parameterDisplayDescription: vscode.l10n.t('The name of the new function app.') } :
            { parameterDisplayTitle: vscode.l10n.t('Site Name'), parameterDisplayDescription: vscode.l10n.t('The name of the app service site.'), };

        if (this._siteFor === "containerizedFunctionApp") {
            siteNamingRules.maxLength = 32;
        }

        const options: AgentInputBoxOptions = {
            prompt,
            placeHolder,
            validateInput: (name: string): string | undefined => this.validateSiteName(name),
            asyncValidationTask: async (name: string): Promise<string | undefined> => await this.asyncValidateSiteName(context, client, name),
            agentMetadata: agentMetadata
        };

        context.newSiteName = (await context.ui.showInputBox(options)).trim();
        context.valuesToMask.push(context.newSiteName);
        context.relatedNameTask ??= this.generateRelatedName(context, context.newSiteName, this.getRelatedResourceNamingRules(context));
    }

    private getRelatedResourceNamingRules(context: SiteNameStepWizardContext): IAzureNamingRules[] {
        const namingRules: IAzureNamingRules[] = [resourceGroupNamingRules];
        if (context.newSiteKind === AppKind.functionapp) {
            namingRules.push(storageAccountNamingRules);
        } else {
            namingRules.push(appServicePlanNamingRules);
        }

        namingRules.push(appInsightsNamingRules);
        return namingRules;
    }

    public async getRelatedName(context: SiteNameStepWizardContext, name: string): Promise<string | undefined> {
        return await this.generateRelatedName(context, name, appServicePlanNamingRules);
    }

    public shouldPrompt(context: SiteNameStepWizardContext): boolean {
        return !context.newSiteName;
    }

    protected async isRelatedNameAvailable(context: SiteNameStepWizardContext, name: string): Promise<boolean> {
        const tasks: Promise<boolean>[] = [ResourceGroupListStep.isNameAvailable(context, name)];
        if (context.newSiteKind === AppKind.functionapp) {
            tasks.push(StorageAccountListStep.isNameAvailable(context, name));
        } else {
            tasks.push(AppServicePlanListStep.isNameAvailable(context, name, name));
        }

        return (await Promise.all(tasks)).every((v: boolean) => v);
    }

    private validateSiteName(name: string): string | undefined {
        name = name.trim();

        if (name.length < siteNamingRules.minLength || name.length > siteNamingRules.maxLength) {
            return vscode.l10n.t('The name must be between {0} and {1} characters.', siteNamingRules.minLength, siteNamingRules.maxLength);
        } else if (this._siteFor === "containerizedFunctionApp" && (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name))) {
            return vscode.l10n.t("A name must consist of lower case alphanumeric characters or '-', start with an alphabetic character, and end with an alphanumeric character and cannot have '--'.");
        } else if (siteNamingRules.invalidCharsRegExp.test(name)) {
            return vscode.l10n.t("The name can only contain letters, numbers, or hyphens.");
        }

        return undefined;
    }

    // Todo: Leave reference to GitHub comment
    private async asyncValidateSiteName(context: SiteNameStepWizardContext, sdkClient: WebSiteManagementClient, name: string): Promise<string | undefined> {
        let validationMessage: string | undefined;

        if (!context.newSiteDomainNameLabelScope || context.newSiteDomainNameLabelScope === DomainNameLabelScope.Global) {
            validationMessage ??= await this.asyncValidateGlobalSiteName(sdkClient, name);
        }
        if (context.newSiteDomainNameLabelScope) {
            validationMessage ??= await this.asyncValidateSiteNameByDomainScope(context, context.newSiteDomainNameLabelScope, name, context.resourceGroup?.name ?? context.newResourceGroupName);
            validationMessage ??= await this.asyncValidateUniqueResourceId(context, sdkClient, name, context.resourceGroup?.name ?? context.newResourceGroupName);
        }

        return validationMessage;
    }

    private async asyncValidateSiteNameByDomainScope(context: SiteNameStepWizardContext, domainNameScope: DomainNameLabelScope, siteName: string, resourceGroupName?: string): Promise<string | undefined> {
        if (!LocationListStep.hasLocation(context)) {
            throw new Error(vscode.l10n.t('Internal Error: A location is required when validating a site name with non-global domain scope.'));
        }
        if (domainNameScope === DomainNameLabelScope.ResourceGroup && !resourceGroupName) {
            throw new Error(vscode.l10n.t('Internal Error: A resource group name is required when validating a site name with resource group level domain scope.'));
        }

        const apiVersion: string = '2024-04-01';
        const location: AzExtLocation = await LocationListStep.getLocation(context);
        const authToken: string = nonNullValueAndProp((await context.credentials.getToken() as { token?: string }), 'token');

        // Todo: Can potentially replace with call using SDK once the update is available
        const options: AzExtRequestPrepareOptions = {
            url: `https://management.azure.com/subscriptions/${context.subscriptionId}/providers/Microsoft.Web/locations/${location.name}/checknameavailability?api-version=${apiVersion}`,
            method: 'POST',
            headers: createHttpHeaders({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            }),
            body: JSON.stringify({
                name: siteName,
                type: 'Site',
                autoGeneratedDomainNameLabelScope: domainNameScope,
                resourceGroupName: domainNameScope === DomainNameLabelScope.ResourceGroup ? resourceGroupName : undefined,
            }),
        };

        const client = await createGenericClient(context, undefined);
        const pipelineResponse = await client.sendRequest(createPipelineRequest(options)) as AzExtPipelineResponse;

        const checkNameResponse = pipelineResponse.parsedBody as {
            hostName?: string;
            message?: string;
            nameAvailable?: boolean;
            reason?: string;
        };
        return !checkNameResponse.nameAvailable ? checkNameResponse.message : undefined;
    }

    private async asyncValidateGlobalSiteName(client: WebSiteManagementClient, name: string): Promise<string | undefined> {
        const nameAvailability: ResourceNameAvailability = await client.checkNameAvailability(name, 'Site');
        if (!nameAvailability.nameAvailable) {
            return nameAvailability.message;
        } else {
            return undefined;
        }
    }

    private async asyncValidateUniqueResourceId(context: SiteNameStepWizardContext, client: WebSiteManagementClient, siteName: string, resourceGroupName?: string): Promise<string | undefined> {
        if (!resourceGroupName) {
            context.relatedNameTask = this.generateRelatedName(context, siteName, this.getRelatedResourceNamingRules(context));
            resourceGroupName = await context.relatedNameTask;
        }

        try {
            const site: Site = await client.webApps.get(
                nonNullValue(resourceGroupName, vscode.l10n.t('Internal Error: A resource group name must be provided to verify a unique Site ID.')),
                siteName
            );
            if (site) {
                return vscode.l10n.t('A site with name "{0}" already exists.', siteName);
            }
        } catch (e) {
            const statusCode = (e as { statusCode?: number })?.statusCode;
            if (statusCode !== 404) {
                return vscode.l10n.t('Failed to validate unique site with name "{0}".  Please try another name.', siteName);
            }
        }

        return undefined;
    }
}
