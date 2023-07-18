/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TreeItemIconPath, nonNullProp } from "@microsoft/vscode-azext-utils";
import * as dayjs from "dayjs";
// eslint-disable-next-line import/no-internal-modules
import * as relativeTime from 'dayjs/plugin/relativeTime';
import { ThemeColor, ThemeIcon, l10n } from "vscode";
import { ActionWorkflowRuns } from "../wrappers/getActions";
import { Job, JobStep } from "../wrappers/getJobs";

dayjs.extend(relativeTime);

/**
 * GitHub 'Check Run' - final conclusion of the check
 * https://developer.github.com/v3/checks/runs/#parameters
 */
export enum Conclusion {
    Success = 'success',
    Failure = 'failure',
    Skipped = 'skipped',
    Cancelled = 'cancelled'
}

/**
 * GitHub 'Check Run' - current status of the check
 */
export enum Status {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed'
}

/**
 * Get a tree item description based on its Job-related status.
 *
 * Note: Typically does not need to be called directly by client extensions
 * unless implementing a custom experience.
 */
export function getJobBasedDescription(data: Job | JobStep): string {
    if (data.conclusion !== null) {
        const conclusion: string = convertConclusionToVerb(<Conclusion>nonNullProp(data, 'conclusion'));
        const completedAt: string = dayjs(data.completed_at).fromNow();
        return `${conclusion} ${completedAt}`;
    } else {
        const status: string = convertStatusToVerb(<Status>nonNullProp(data, 'status'));
        const startedAt: string = !data.started_at ? l10n.t('now') : dayjs(data.started_at).fromNow();
        return `${status} ${startedAt}`;
    }
}

/**
 * Select an icon based on its Action-related status.
 *
 * Note: Typically does not need to be called directly by client extensions
 * unless implementing a custom experience.
 */
export function getActionBasedIconPath(data: ActionWorkflowRuns | Job | JobStep): TreeItemIconPath {
    let id: string;
    let colorId: string | undefined;
    if (data.conclusion !== null) {
        switch (<Conclusion>nonNullProp(data, 'conclusion')) {
            case Conclusion.Cancelled:
                id = 'circle-slash';
                colorId = 'testing.iconUnset';
                break;
            case Conclusion.Failure:
                id = 'error';
                colorId = 'testing.iconFailed';
                break;
            case Conclusion.Skipped:
                id = 'debug-step-over';
                colorId = 'testing.iconSkipped';
                break;
            case Conclusion.Success:
                id = 'pass'
                colorId = 'testing.iconPassed';
                break;
        }
    } else {
        switch (<Status>nonNullProp(data, 'status')) {
            case Status.Queued:
                id = 'clock';
                colorId = 'testing.iconQueued';
                break;
            case Status.InProgress:
                id = 'play-circle';
                colorId = 'testing.iconUnset';
                break;
            case Status.Completed:
                id = 'pass';
                colorId = 'testing.iconPassed';
                break;
        }
    }

    return new ThemeIcon(id, colorId ? new ThemeColor(colorId) : undefined);
}

// Helpers...
function convertConclusionToVerb(conclusion: Conclusion): string {
    switch (conclusion) {
        case Conclusion.Success:
            return l10n.t('succeeded');
        case Conclusion.Cancelled:
            return l10n.t('cancelled');
        case Conclusion.Failure:
            return l10n.t('failed');
        case Conclusion.Skipped:
            return l10n.t('skipped');
        default:
            return '';
    }
}

function convertStatusToVerb(status: Status): string {
    switch (status) {
        case Status.InProgress:
            return l10n.t('started');
        case Status.Queued:
            return l10n.t('queued');
        case Status.Completed:
            return l10n.t('completed');
        default:
            return '';
    }
}
