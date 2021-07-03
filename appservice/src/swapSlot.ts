/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ProgressLocation, window } from 'vscode';
import { AzureTreeItem, IActionContext, IAzureQuickPickItem } from 'vscode-azureextensionui';
import { ext } from './extensionVariables';
import { localize } from './localize';
import { SiteClient } from './SiteClient';
import { ISiteTreeRoot } from './tree/ISiteTreeRoot';
import { createWebSiteClient } from './utils/azureClients';

export async function swapSlot(context: IActionContext, sourceSlotNode: AzureTreeItem<ISiteTreeRoot>, existingSlots: AzureTreeItem<ISiteTreeRoot>[]): Promise<void> {
    const sourceSlotClient: SiteClient = sourceSlotNode.root.client;

    const productionSlotLabel: string = 'production';
    const otherSlots: IAzureQuickPickItem<AzureTreeItem<ISiteTreeRoot> | undefined>[] = [{
        label: productionSlotLabel,
        data: undefined
    }];

    for (const slot of existingSlots) {
        if (sourceSlotClient.slotName !== slot.root.client.slotName) {
            // Deployment slots must have an unique name
            const otherSlot: IAzureQuickPickItem<AzureTreeItem<ISiteTreeRoot> | undefined> = {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                label: slot.root.client.slotName!,
                data: slot
            };

            otherSlots.push(otherSlot);
        }
    }

    const placeHolder: string = localize('selectSlotToSwap', 'Select which slot to swap with "{0}".', sourceSlotClient.slotName);
    const targetSlot: AzureTreeItem<ISiteTreeRoot> | undefined = (await context.ui.showQuickPick(otherSlots, { placeHolder })).data;

    const targetSlotLabel: string = targetSlot ? targetSlot.root.client.fullName : `${sourceSlotClient.siteName}-${productionSlotLabel}`;
    const swappingSlots: string = localize('swapping', 'Swapping "{0}" with "{1}"...', targetSlotLabel, sourceSlotClient.fullName);
    const successfullySwapped: string = localize('swapped', 'Successfully swapped "{0}" with "{1}".', targetSlotLabel, sourceSlotClient.fullName);
    ext.outputChannel.appendLog(swappingSlots);
    const client: WebSiteManagementClient = await createWebSiteClient(sourceSlotNode.root);
    await window.withProgress({ location: ProgressLocation.Notification, title: swappingSlots }, async () => {
        // if targetSlot was assigned undefined, the user selected 'production'
        if (!targetSlot) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await client.webApps.swapSlotWithProduction(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: sourceSlotClient.slotName!, preserveVnet: true });
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await client.webApps.swapSlotSlot(sourceSlotClient.resourceGroup, sourceSlotClient.siteName, { targetSlot: targetSlot.root.client.slotName!, preserveVnet: true }, sourceSlotClient.slotName!);
        }
        void window.showInformationMessage(successfullySwapped);
        ext.outputChannel.appendLog(successfullySwapped);
    });
}
