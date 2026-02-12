/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { CancellationToken, Command, MarkdownString, Progress, ProviderResult, TreeItemCollapsibleState } from 'vscode';
import type { Activity, AppResource } from '../../hostapi';
import type { TreeElementBase } from './treeV2';
import type { TreeItemIconPath } from './treeItem';
import type { ActivityChildType } from '../tree/v2/ActivityChildItem';

export type ActivityTask<R> = (progress: Progress<{ message?: string, increment?: number }>, cancellationToken: CancellationToken) => Promise<R>;

/**
 * Represents the base structure for an activity child item in the activity log.
 */
export interface ActivityChildItemBase extends TreeElementBase {
    /**
     * An internal flag that is sometimes used to determine whether this item has been modified by the activity log API.
     * This flag is checked to ensure that the item is only modified once.
     */
    _hasBeenModified?: boolean;
    label?: string;
    activityType: ActivityChildType;
    contextValue?: string;
    description?: string;
    stepId?: string;
    getChildren?(): ProviderResult<ActivityChildItemBase[]>;
}

export type ActivityChildItemOptions = {
    id?: string;
    label: string;
    contextValue: string;
    activityType: ActivityChildType;
    command?: Command;
    description?: string;
    iconPath?: TreeItemIconPath;
    tooltip?: string | MarkdownString | undefined;
    stepId?: string;
    initialCollapsibleState?: TreeItemCollapsibleState;
    /**
     * If set to true, will initialize `getChildren` with an empty array.
     */
    isParent?: boolean;
};

export interface ActivityAttributes {
    /**
     * A description or summary of the command or activity being run
     */
    description?: string;
    /**
     * A troubleshooting guide that can be used for reference by Copilot to help users fix issues
     */
    troubleshooting?: string[];
    /**
     * Any relevant logs related to the command or activity being run
     */
    logs?: LogActivityAttributes[];
    /**
     * Any relevant files related to the command or activity being run
     */
    files?: FileActivityAttributes[];
    /**
     * Any Azure resource envelope related to the command or activity being run
     */
    azureResource?: unknown;

    // For additional one-off properties that could be useful for Copilot
    [key: string]: unknown;
}

export type LogActivityAttributes = {
    name?: string;
    description?: string;
    content?: string;
};

export type FileActivityAttributes = {
    name?: string;
    path?: string;
    description?: string;
    content?: string;
};

export interface ExecuteActivityOutput {
    /**
     * The activity child item to display on success, fail, or progress
     */
    item?: ActivityChildItemBase;
    /**
     * The output log message to display on success, fail, or progress
     */
    message?: string;
}

export interface ExecuteActivityContext {
    registerActivity: (activity: Activity) => Promise<void>;
    /**
     * Becomes label of activity tree item, defaults to wizard title or "Azure Activity"
     */
    activityTitle?: string;
    /**
     * Resource or resourceId
     *
     * Set to show a "Click to view resource" child on success.
     */
    activityResult?: AppResource | string;
    /**
     * The command / callback id for the activity.
     */
    callbackId?: string;
    /**
     * Hide activity notifications
     */
    suppressNotification?: boolean;
    /**
     * Hide the progress report messages emitted from execute steps
     */
    suppressProgress?: boolean;
    /**
     * The activity implementation to use, defaults to ExecuteActivity
     */
    wizardActivity?: new <TContext extends ExecuteActivityContext>(context: TContext, task: ActivityTask<void>) => import('../activityLog/activities/ExecuteActivity').ExecuteActivity;
    /**
     * Children to show under the activity tree item.
     */
    activityChildren?: ActivityChildItemBase[];

    /**
     * Activity / Command attributes to be shared with Copilot
     */
    activityAttributes?: ActivityAttributes;
}

export type ActivityInfoChild = ActivityChildItemBase & { activityType: ActivityChildType.Info };
