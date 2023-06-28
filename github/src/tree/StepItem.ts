/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { TreeElementBase } from "@microsoft/vscode-azext-utils";
import type { ViewPropertiesModel } from "@microsoft/vscode-azureresources-api";
import { TreeItem } from "vscode";
import { getActionBasedIconPath, getJobBasedDescription } from "../utils/actionUtils";
import { JobStep } from "../wrappers/getJobs";

export class StepItem implements TreeElementBase {
    static contextValueSuffix: string = 'StepItem';

    constructor(
        readonly parentResourceId: string,
        readonly contextValueExtensionPrefix: string,
        readonly step: JobStep) { }

    id: string = `${this.parentResourceId}/steps/${this.step.number}`;
    label: string = this.step.name;

    viewProperties: ViewPropertiesModel = {
        data: this.step,
        label: this.step.name,
    };

    getTreeItem(): TreeItem {
        return {
            id: this.id,
            label: this.label,
            description: getJobBasedDescription(this.step),
            iconPath: getActionBasedIconPath(this.step),
            contextValue: `${this.contextValueExtensionPrefix}${StepItem.contextValueSuffix}`
        };
    }
}
