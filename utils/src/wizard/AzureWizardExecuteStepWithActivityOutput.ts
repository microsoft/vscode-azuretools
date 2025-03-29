/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { v4 as uuidv4 } from "uuid";
import { l10n } from 'vscode';
import * as types from '../../index';
import { activityFailContext, activityFailIcon, activityProgressContext, activityProgressIcon, activitySuccessContext, activitySuccessIcon } from '../constants';
import { GenericParentTreeItem } from '../tree/GenericParentTreeItem';
import { GenericTreeItem } from '../tree/GenericTreeItem';
import { createContextValue } from '../utils/contextUtils';
import { nonNullValue } from '../utils/nonNull';
import { AzureWizardExecuteStep } from "./AzureWizardExecuteStep";

export enum ActivityOutputState {
    Success = 'success',
    Fail = 'fail',
    Progress = 'progress',
}

export abstract class AzureWizardExecuteStepWithActivityOutput<T extends types.IActionContext> extends AzureWizardExecuteStep<T> {
    abstract stepName: string;
    protected abstract getSuccessString(context: T): string;
    protected abstract getFailString(context: T): string;
    protected getProgressString?(context: T): string;
    protected getTreeItemLabel?(context: T): string;

    public createSuccessOutput(context: T): types.ExecuteActivityOutput {
        const success: string = this.getSuccessString(context);

        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Success,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel ? this.getTreeItemLabel(context) : success,
            outputLogMessage: success,
        });
    }

    public createProgressOutput(context: T): types.ExecuteActivityOutput {
        const progress: string | undefined = this.getProgressString?.(context);

        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Progress,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel ? this.getTreeItemLabel(context) : nonNullValue(progress, l10n.t('If getTreeItemLabel is not provided, then getProgressString must be set.')),
            outputLogMessage: progress,
        });
    }

    public createFailOutput(context: T): types.ExecuteActivityOutput {
        const fail: string = this.getFailString(context);

        return createExecuteActivityOutput(context, {
            outputType: ActivityOutputState.Fail,
            stepName: this.stepName,
            treeItemLabel: this.getTreeItemLabel ? this.getTreeItemLabel(context) : fail,
            outputLogMessage: fail,
        });
    }
}

type ActivityOutputCreateOptions = {
    stepName: string;
    treeItemLabel: string;
    outputLogMessage?: string;
    outputType: types.ActivityOutputState;
};

function createExecuteActivityOutput(_: types.IActionContext, options: ActivityOutputCreateOptions): types.ExecuteActivityOutput {
    const activityContext = options.outputType === ActivityOutputState.Success ? activitySuccessContext : options.outputType === ActivityOutputState.Fail ? activityFailContext : activityProgressContext;
    const contextValue = createContextValue([`${options.stepName}${options.outputType}Item`, activityContext]);
    const label = options.treeItemLabel;
    const iconPath = options.outputType === ActivityOutputState.Success ? activitySuccessIcon : options.outputType === ActivityOutputState.Fail ? activityFailIcon : activityProgressIcon;

    const item = options.outputType === ActivityOutputState.Fail ?
        // If the output type is "Fail", return a parent tree item to allow attaching error details as children for better user context.
        new GenericParentTreeItem(undefined, {
            id: uuidv4(),
            contextValue,
            label,
            iconPath
        }) :
        // Otherwise, return a simple tree item for "Success" or "Progress" states.
        new GenericTreeItem(undefined, {
            id: uuidv4(),
            contextValue,
            label,
            iconPath
        });

    return {
        item,
        message: options.outputLogMessage,
    }
}
