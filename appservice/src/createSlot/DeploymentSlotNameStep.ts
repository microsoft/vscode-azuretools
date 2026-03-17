/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CheckNameAvailabilityResponse } from '@azure/arm-appservice';
import type { ServiceClient } from '@azure/core-client';
import { createGenericClient } from '@microsoft/vscode-azext-azureutils';
import { AzureWizardPromptStep, IAzureNamingRules, nonNullProp } from '@microsoft/vscode-azext-utils';
import { l10n } from 'vscode';
import { ParsedSite } from '../SiteClient';
import { checkNameAvailability } from '../utils/azureUtils';
import { ICreateSlotContext } from './ICreateSlotContext';

const slotNamingRules: IAzureNamingRules = {
    minLength: 2,
    maxLength: 59,
    // eslint-disable-next-line no-useless-escape
    invalidCharsRegExp: /[^a-zA-Z0-9\-]/
};

export class DeploymentSlotNameStep extends AzureWizardPromptStep<ICreateSlotContext> {
    public async prompt(context: ICreateSlotContext): Promise<void> {
        const parentSite: ParsedSite = nonNullProp(context, 'parentSite');
        const client: ServiceClient = await createGenericClient(context, parentSite.subscription);

        context.newDeploymentSlotName = (await context.ui.showInputBox({
            prompt: l10n.t('Enter a unique name for the new deployment slot'),
            stepName: 'slotName',
            validateInput: async (value: string): Promise<string | undefined> => {
                return validateSlotName(value, client, parentSite);
            }
        })).trim();
    }

    public shouldPrompt(context: ICreateSlotContext): boolean {
        return !context.newDeploymentSlotName;
    }
}

async function validateSlotName(value: string, client: ServiceClient, site: ParsedSite): Promise<string | undefined> {
    value = value.trim();
    // Can not have "production" as a slot name, but checkNameAvailability doesn't validate that
    if (value === 'production') {
        return l10n.t('The slot name "{0}" is not available.', value);
    } else if (value.length < slotNamingRules.minLength) {
        return l10n.t('The slot name must be at least {0} characters.', slotNamingRules.minLength);
    } else if (value.length + site.siteName.length > slotNamingRules.maxLength) {
        return l10n.t('The combined site name and slot name must be fewer than {0} characters.', slotNamingRules.maxLength);
    } else if (slotNamingRules.invalidCharsRegExp.test(value)) {
        return l10n.t("The name can only contain letters, numbers, or hyphens.");
    } else {
        const nameAvailability: CheckNameAvailabilityResponse = await checkNameAvailability(client, site.subscription.subscriptionId, `${site.siteName}-${value}`, 'Slot');
        if (!nameAvailability.nameAvailable) {
            return nameAvailability.message;
        } else {
            return undefined;
        }
    }
}
