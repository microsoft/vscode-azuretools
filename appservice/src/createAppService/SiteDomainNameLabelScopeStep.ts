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
            // Matching the portal which doesn't yet offer ResourceGroup and Subscription level domain scope
            { label: vscode.l10n.t('Secure unique default hostname'), description: vscode.l10n.t('Tenant'), data: DomainNameLabelScope.Tenant },
            { label: vscode.l10n.t('Global default hostname'), description: vscode.l10n.t('Global'), data: DomainNameLabelScope.Global },
            { label: vscode.l10n.t('$(link-external) Learn more about unique default hostname'), data: undefined },
        ];

        let result: DomainNameLabelScope | undefined;
        do {
            result = (await context.ui.showQuickPick(picks, {
                placeHolder: vscode.l10n.t('Select default hostname format'),
                suppressPersistence: true,
            })).data;

            if (!result) {
                await openUrl('https://aka.ms/AAu7lhs');
            }
        } while (!result);

        context.telemetry.properties.siteDomainNameLabelScope = result;
        context.newSiteDomainNameLabelScope = result;
    }

    public shouldPrompt(context: T): boolean {
        return !context.newSiteDomainNameLabelScope;
    }
}
