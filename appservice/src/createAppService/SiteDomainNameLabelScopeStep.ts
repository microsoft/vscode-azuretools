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
    Global = 'NoReuse',
}

export class SiteDomainNameLabelScopeStep<T extends IAppServiceWizardContext> extends AzureWizardPromptStep<T> {
    public async prompt(context: T): Promise<void> {
        const picks: IAzureQuickPickItem<DomainNameLabelScope | undefined>[] = [
            { label: vscode.l10n.t('Tenant'), description: vscode.l10n.t('(recommended)'), data: DomainNameLabelScope.Tenant },
            { label: vscode.l10n.t('Global'), data: DomainNameLabelScope.Global },
            { label: vscode.l10n.t('Subscription'), data: DomainNameLabelScope.Subscription },
            { label: vscode.l10n.t('Resource group'), data: DomainNameLabelScope.ResourceGroup },
            { label: vscode.l10n.t('$(link-external) Learn more about domain name label scopes'), data: undefined },
        ];

        let result: DomainNameLabelScope | undefined;
        do {
            result = (await context.ui.showQuickPick(picks, {
                placeHolder: vscode.l10n.t('Select a domain name label scope'),
                suppressPersistence: true,
            })).data;

            if (!result) {
                await openUrl('https://aka.ms/AAu2xga');
            }
        } while (!result);

        context.telemetry.properties.siteDomainNameLabelScope = result;
        context.newSiteDomainNameLabelScope = result;
    }

    public shouldPrompt(context: T): boolean {
        return !context.newSiteDomainNameLabelScope;
    }
}
