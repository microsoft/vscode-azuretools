/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, openUrl } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import { IAppServiceWizardContext } from './IAppServiceWizardContext';

export enum DomainNameLabelScope {
    ResourceGroup = 'ResourceGroupReuse',
    Subscription = 'SubscriptionReuse',
    Tenant = 'TenantReuse',
    NoReuse = 'NoReuse',
}

export class SiteDomainNameLabelScopeStep<T extends IAppServiceWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        const learnMore = 'learnMore';
        const picks: IAzureQuickPickItem<DomainNameLabelScope | typeof learnMore | undefined>[] = [
            // Matching the portal which doesn't yet offer anything beyond `Tenant` and `Legacy` offerings
            // If new domain name label scopes are added to this pick list, it is required to implement corresponding naming validation under `SiteNameStep`
            // Example of the kinds of changes that may be required: https://github.com/microsoft/vscode-azuretools/pull/2182#discussion_r2760621222
            { label: vscode.l10n.t('Secure unique default hostname'), description: vscode.l10n.t('Tenant Scope'), data: DomainNameLabelScope.Tenant },
            { label: vscode.l10n.t('Global default hostname'), description: vscode.l10n.t('Legacy'), data: undefined },
            { label: vscode.l10n.t('$(link-external) Learn more about unique default hostname'), data: learnMore },
        ];
        const learnMoreUrl: string = 'https://aka.ms/AAu7lhs';

        let result: DomainNameLabelScope | typeof learnMore | undefined;
        do {
            result = (await context.ui.showQuickPick(picks, {
                placeHolder: vscode.l10n.t('Select default hostname format'),
                suppressPersistence: true,
                learnMoreLink: learnMoreUrl,
            })).data;

            if (result === learnMore) {
                await openUrl(learnMoreUrl);
            }
        } while (result === learnMore);

        context.newSiteDomainNameLabelScope = result;
        context.telemetry.properties.siteDomainNameLabelScope = context.newSiteDomainNameLabelScope;
    }

    public shouldPrompt(context: T): boolean {
        return !context.newSiteDomainNameLabelScope;
    }
}
