/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Site } from "@azure/arm-appservice";
import { AzureWizard, ICreateChildImplContext, nonNullProp } from "@microsoft/vscode-azext-utils";
import { ParsedSite } from './SiteClient';
import { DeploymentSlotConfigSourceStep } from "./createSlot/DeploymentSlotConfigSourceStep";
import { DeploymentSlotCreateStep } from "./createSlot/DeploymentSlotCreateStep";
import { DeploymentSlotNameStep } from "./createSlot/DeploymentSlotNameStep";
import { ICreateSlotContext } from "./createSlot/ICreateSlotContext";

/**
 * @deprecated Use `DeploymentSlotNameStep`, `DeploymentSlotConfigSourceStep`, and `DeploymentSlotCreateStep` instead
 * to properly separate prompting from execution in the Azure Activity log.
 */
export async function createSlot(site: ParsedSite, existingSlots: ParsedSite[], context: ICreateChildImplContext): Promise<Site> {
    const wizardContext: ICreateSlotContext = Object.assign(context, {
        parentSite: site,
        existingSlots,
    });

    const wizard = new AzureWizard<ICreateSlotContext>(wizardContext, {
        promptSteps: [new DeploymentSlotNameStep(), new DeploymentSlotConfigSourceStep()],
        executeSteps: [new DeploymentSlotCreateStep()]
    });

    await wizard.prompt();
    await wizard.execute();
    return nonNullProp(wizardContext, 'site');
}
