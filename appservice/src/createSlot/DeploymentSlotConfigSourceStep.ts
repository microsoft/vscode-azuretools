/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AzureWizardPromptStep, IAzureQuickPickItem, nonNullProp } from '@microsoft/vscode-azext-utils';
import { l10n } from 'vscode';
import { ParsedSite } from '../SiteClient';
import { ICreateSlotContext } from './ICreateSlotContext';

export class DeploymentSlotConfigSourceStep extends AzureWizardPromptStep<ICreateSlotContext> {
    public async prompt(context: ICreateSlotContext): Promise<void> {
        const parentSite: ParsedSite = nonNullProp(context, 'parentSite');
        const existingSlots: ParsedSite[] = nonNullProp(context, 'existingSlots');

        if (parentSite.isFunctionApp) {
            // Function apps always clone from production slot without prompting
            context.newDeploymentSlotConfigSource = parentSite;
            context.hasPromptedSlotConfigSource = true;
            return;
        }

        const configurationSources: IAzureQuickPickItem<ParsedSite | undefined>[] = [{
            label: l10n.t("Don't clone configuration from an existing slot"),
            data: undefined
        }];

        // add the production slot itself
        configurationSources.push({
            label: parentSite.fullName,
            data: parentSite
        });

        // add the web app's current deployment slots
        for (const slot of existingSlots) {
            configurationSources.push({
                label: slot.fullName,
                data: slot
            });
        }

        const placeHolder: string = l10n.t('Choose a configuration source.');
        context.newDeploymentSlotConfigSource = (await context.ui.showQuickPick(configurationSources, { placeHolder, stepName: 'slotConfigSource' })).data;
        context.hasPromptedSlotConfigSource = true;
    }

    public shouldPrompt(context: ICreateSlotContext): boolean {
        return !context.hasPromptedSlotConfigSource;
    }
}
