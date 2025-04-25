/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ActivityChildItem, ActivityChildType, activityFailContext, activityFailIcon, activityProgressContext, activityProgressIcon, activitySuccessContext, activitySuccessIcon, AzureWizardExecuteStep, createContextValue, ExecuteActivityOutput, nonNullProp } from "@microsoft/vscode-azext-utils";
import { l10n, Progress } from "vscode";
import { InnerDeployContext } from "../../IDeployContext";
import { waitForDeploymentToComplete } from "../../waitForDeploymentToComplete";

export class WaitForDeploymentToCompleteStep extends AzureWizardExecuteStep<InnerDeployContext> {
    public stepName: string = 'WaitForDeploymentToCompleteStep';
    public priority: number = 210;
    public createSuccessOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activitySuccessContext, context.site.id]),
                label: l10n.t('Finished deployment pipeline.'),
                iconPath: activitySuccessIcon,
                activityType: ActivityChildType.Success,

            })
        };
    }
    public createProgressOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activityProgressContext, context.site.id]),
                label: l10n.t('Waiting for deployment to complete...', context.site.fullName),
                iconPath: activityProgressIcon,
                activityType: ActivityChildType.Progress,

            })
        };
    }
    public createFailOutput(context: InnerDeployContext): ExecuteActivityOutput {
        return {
            item: new ActivityChildItem({
                contextValue: createContextValue([activityFailContext, context.site.id]),
                label: l10n.t('Deployment failed.'),
                iconPath: activityFailIcon,
                activityType: ActivityChildType.Fail,

            })
        };
    }

    public async execute(context: InnerDeployContext, progress: Progress<{ message?: string; increment?: number }>): Promise<void> {
        return await waitForDeploymentToComplete(context, nonNullProp(context, 'site'), { locationUrl: context.locationUrl, progress });
    }

    public shouldExecute(_context: InnerDeployContext): boolean {
        return true;
    }
}
