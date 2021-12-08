/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { WebSiteManagementClient } from '@azure/arm-appservice';
import { ProgressLocation, window } from 'vscode';
import { IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { ParsedSite } from './SiteClient';
import { createWebSiteClient } from './utils/azureClients';

export async function swapSlot(context: IActionContext, sourceSlot: ParsedSite, existingSlots: ParsedSite[]): Promise<void> {
    const productionSlotLabel: string = 'production';
    const otherSlots: IAzureQuickPickItem<ParsedSite | undefined>[] = [{
        label: productionSlotLabel,
        data: undefined
    }];

    for (const slot of existingSlots) {
        if (sourceSlot.slotName !== slot.slotName) {
            // Deployment slots must have an unique name
            const otherSlot: IAzureQuickPickItem<ParsedSite | undefined> = {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: slot.slotName!,
                data: slot
            };

            otherSlots.push(otherSlot);
        }
    }

    const placeHolder: string = localize('selectSlotToSwap', 'Select which slot to swap with "{0}".', sourceSlot.slotName);
    const targetSlot = (await context.ui.showQuickPick(otherSlots, { placeHolder, stepName: 'swapSlot' })).data;

    const targetSlotLabel: string = targetSlot ? targetSlot.fullName : `${sourceSlot.siteName}-${productionSlotLabel}`;
    const swappingSlots: string = localize('swapping', 'Swapping "{0}" with "{1}"...', targetSlotLabel, sourceSlot.fullName);
    const successfullySwapped: string = localize('swapped', 'Successfully swapped "{0}" with "{1}".', targetSlotLabel, sourceSlot.fullName);
    ext.outputChannel.appendLog(swappingSlots);
    const client: WebSiteManagementClient = await createWebSiteClient([context, sourceSlot.subscription]);
    await window.withProgress({ location: ProgressLocation.Notification, title: swappingSlots }, async () => {
        // if targetSlot was assigned undefined, the user selected 'production'
        if (!targetSlot) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await client.webApps.swapSlotWithProduction(sourceSlot.resourceGroup, sourceSlot.siteName, { targetSlot: sourceSlot.slotName!, preserveVnet: true });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await client.webApps.swapSlotSlot(sourceSlot.resourceGroup, sourceSlot.siteName, { targetSlot: targetSlot.slotName!, preserveVnet: true }, sourceSlot.slotName!);
        }
        void window.showInformationMessage(successfullySwapped);
        ext.outputChannel.appendLog(successfullySwapped);
    });
}
