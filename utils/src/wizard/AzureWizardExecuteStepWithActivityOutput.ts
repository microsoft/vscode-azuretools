/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemCollapsibleState } from 'vscode';
import * as types from '../../index';
import { activityFailContext, activityFailIcon, activityProgressContext, activityProgressIcon, activitySuccessContext, activitySuccessIcon } from '../constants';
import { ActivityChildItem, ActivityChildType } from "../tree/v2/ActivityChildItem";
import { createContextValue } from '../utils/contextUtils';
import { AzureWizardExecuteStep } from "./AzureWizardExecuteStep";

enum ActivityOutputState {
    Success = 'success',
    Fail = 'fail',
    Progress = 'progress',
}

export abstract class AzureWizardExecuteStepWithActivityOutput<T extends types.IActionContext> extends AzureWizardExecuteStep<T> {
    abstract readonly stepName: string;
    protected abstract getTreeItemLabel(context: T): string;
    protected abstract getOutputLogSuccess(context: T): string;
    protected abstract getOutputLogFail(context: T): string;
    protected getOutputLogProgress?(context: T): string;

    public createSuccessOutput(context: T): types.ExecuteActivityOutput {
        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Success,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel(context),
            outputLogMessage: this.getOutputLogSuccess(context),
        });
    }

    public createProgressOutput(context: T): types.ExecuteActivityOutput {
        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Progress,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel(context),
            outputLogMessage: this.getOutputLogProgress?.(context),
        });
    }

    public createFailOutput(context: T): types.ExecuteActivityOutput {
        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Fail,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel(context),
            outputLogMessage: this.getOutputLogFail(context),
        });
    }
}

type ActivityOutputCreateOptions = {
    stepName: string;
    treeItemLabel: string;
    outputLogMessage: string | undefined;
    outputType: ActivityOutputState;
};

function createExecuteActivityOutput(_: types.IActionContext, options: ActivityOutputCreateOptions): types.ExecuteActivityOutput {
    const activityType = options.outputType === ActivityOutputState.Success ? ActivityChildType.Success : options.outputType === ActivityOutputState.Fail ? ActivityChildType.Fail : ActivityChildType.Progress;
    const activityContext = options.outputType === ActivityOutputState.Success ? activitySuccessContext : options.outputType === ActivityOutputState.Fail ? activityFailContext : activityProgressContext;
    const contextValue = createContextValue([`${options.stepName}Item`, activityContext]);
    const label = options.treeItemLabel;
    const iconPath = options.outputType === ActivityOutputState.Success ? activitySuccessIcon : options.outputType === ActivityOutputState.Fail ? activityFailIcon : activityProgressIcon;

    return {
        item: new ActivityChildItem({
            contextValue,
            label,
            iconPath,
            activityType,
            initialCollapsibleState: options.outputType === ActivityOutputState.Fail ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.None,
            isParent: options.outputType === ActivityOutputState.Fail,
        }),
        message: options.outputLogMessage,
    };
}
