/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Identity } from '@azure/arm-msi';
import { AzureWizardPromptStep, IAzureQuickPickItem, IAzureQuickPickOptions, IWizardOptions } from '@microsoft/vscode-azext-utils';
import * as vscode from 'vscode';
import * as types from '../../index';
import { createManagedServiceIdentityClient } from '../clients';
import { uiUtils } from '../utils/uiUtils';
import { UserAssignedIdentityCreateStep } from './UserAssignedIdentityCreateStep';

export class UserAssignedIdentityListStep<T extends types.IResourceGroupWizardContext> extends AzureWizardPromptStep<T> {
    private _suppressCreate: boolean | undefined;

    public constructor(suppressCreate?: boolean) {
        super();
        this._suppressCreate = suppressCreate;
    }

    public async prompt(wizardContext: T): Promise<void> {
        const options: IAzureQuickPickOptions = { placeHolder: 'Select a user assigned identity.', id: `UserAssignedIdentityListStep` };
        wizardContext.managedIdentity = (await wizardContext.ui.showQuickPick(this.getQuickPicks(wizardContext), options)).data;
    }

    public shouldPrompt(wizardContext: T): boolean {
        return !wizardContext.managedIdentity;
    }

    public async getSubWizard(wizardContext: T): Promise<IWizardOptions<T> | undefined> {
        if (!wizardContext.managedIdentity) {
            return {
                executeSteps: [new UserAssignedIdentityCreateStep()]
            }
        }

        return undefined;
    }

    private async getQuickPicks(wizardContext: T): Promise<IAzureQuickPickItem<Identity | undefined>[]> {
        const picks: IAzureQuickPickItem<Identity | undefined>[] = [];
        const miClient = await createManagedServiceIdentityClient(wizardContext);
        const uai = await uiUtils.listAllIterator(miClient.userAssignedIdentities.listBySubscription());

        if (!this._suppressCreate) {
            picks.push({
                label: vscode.l10n.t('$(plus) Create new user assigned identity'),
                description: '',
                data: undefined
            });
        }

        return picks.concat(uai.map((i: Identity) => {
            return {
                id: i.id,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: i.name!,
                description: i.location,
                data: i
            };
        }));
    }
}
