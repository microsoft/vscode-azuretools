/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, activityProgressContext, activityProgressIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createContextValue, ExecuteActivityOutput, nonNullProp } from "@microsoft/vscode-azext-utils";
import { randomUUID } from "crypto";
import { l10n, Progress, ThemeIcon, TreeItemCollapsibleState } from "vscode";
import { ext } from "../../../extensionVariables";
import { InnerDeployContext } from "../../IDeployContext";
import { waitForDeploymentToComplete } from "../../waitForDeploymentToComplete";

export class WaitForDeploymentToCompleteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public stepName: string = 'WaitForDeploymentToCompleteStep';
    public priority: number = 210;
    private _command: { title: string; command: string } = {
        title: '',
        command: ext.prefix + '.showOutputChannel'
    };
    private _childId: string = randomUUID(); // create child id in class to make it idempotent
    public createSuccessOutput(context: InnerDeployContext): ExecuteActivityOutput {
        const label = context.site.isSlot ? l10n.t('Build slot "{0}" in Azure', context.site.fullName) : l10n.t('Build app "{0}" in Azure', context.site.fullName);
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activitySuccessContext, context.site.id]),
                label,
                iconPath: activitySuccessIcon,
                activityType: ActivityChildType.Success,

            })
        };
    }
    public createProgressOutput(context: InnerDeployContext): ExecuteActivityOutput {
        const label = context.site.isSlot ? l10n.t('Build slot "{0}" in Azure', context.site.fullName) : l10n.t('Build app "{0}" in Azure', context.site.fullName);
        const item = new ActivityChildItem({
            contextValue: createContextValue([activityProgressContext, context.site.id]),
            label,
            iconPath: activityProgressIcon,
            activityType: ActivityChildType.Progress,
            isParent: true,
            initialCollapsibleState: TreeItemCollapsibleState.Expanded
        });

        item.getChildren = () => {
            return [
                new ActivityChildItem({
                    label: l10n.t('Click to view output channel'),
                    id: this._childId,
                    command: this._command,
                    activityType: ActivityChildType.Info,
                    contextValue: createContextValue([activityProgressContext, 'viewOutputChannel']),
                    iconPath: new ThemeIcon('output')
                })
            ];
        };

        return {
            item
        };
    }
    public createFailOutput(context: InnerDeployContext): ExecuteActivityOutput {
        const label = context.site.isSlot ? l10n.t('Build slot "{0}" in Azure', context.site.fullName) : l10n.t('Build app "{0}" in Azure', context.site.fullName);
        const item = new ActivityChildItem({
            contextValue: createContextValue([activityFailContext, context.site.id]),
            label,
            iconPath: activityFailIcon,
            activityType: ActivityChildType.Fail,
            isParent: true,
            initialCollapsibleState: TreeItemCollapsibleState.Expanded
        });

        item.getChildren = () => {
            return [
                new ActivityChildItem({
                    label: l10n.t('Click to view output channel'),
                    id: this._childId,
                    command: this._command,
                    activityType: ActivityChildType.Info,
                    contextValue: createContextValue([activityProgressContext, 'viewOutputChannel']),
                    iconPath: new ThemeIcon('output')
                })
            ];
        };

        return {
            item
        };
    }

    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        return await waitForDeploymentToComplete(context, nonNullProp(context, 'site'), { locationUrl: context.locationUrl, progress });
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
