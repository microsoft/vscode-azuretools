/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { Site } from '@azure/arm-appservice';
import { ICreateChildImplContext } from '@microsoft/vscode-azext-utils';
import { ParsedSite } from '../SiteClient';

export interface ICreateSlotContext extends ICreateChildImplContext {
    /**
     * The name of the new deployment slot.
     * This will be defined after `DeploymentSlotNameStep.prompt` occurs.
     */
    newDeploymentSlotName?: string;

    /**
     * The configuration source to clone settings from.
     * This will be defined after `DeploymentSlotConfigSourceStep.prompt` occurs.
     * Undefined means "Don't clone configuration."
     */
    newDeploymentSlotConfigSource?: ParsedSite;

    /**
     * Whether the configuration source prompt has been shown.
     */
    hasPromptedSlotConfigSource?: boolean;

    /**
     * The existing deployment slots for the parent site.
     */
    existingSlots?: ParsedSite[];

    /**
     * The parent site for the new slot.
     */
    parentSite?: ParsedSite;

    /**
     * The newly created site.
     * This will be defined after `DeploymentSlotCreateStep.execute` occurs.
     */
    site?: Site;
}
