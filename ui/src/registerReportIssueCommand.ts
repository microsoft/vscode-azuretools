/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
import * as types from '../index';
import { ext } from "./extensionVariables";
import { localize } from './localize';
import { registerCommand } from "./registerCommand";
import { IReportableIssue, reportAnIssue } from './reportAnIssue';
import { nonNullValue } from './utils/nonNull';

dayjs.extend(relativeTime);

let cachedIssues: IReportableIssue[] | undefined;
export function cacheIssueForCommand(issue: IReportableIssue): void {
    if (cachedIssues) {
        cachedIssues.push(issue);

        // Remove any duplicate issues
        cachedIssues = cachedIssues.filter(i => {
            return i === issue || i.callbackId !== issue.callbackId || i.error.message !== issue.error.message;
        });

        const maxIssues: number = 50;
        if (cachedIssues.length > maxIssues) {
            cachedIssues.shift();
        }
    }
}

export function registerReportIssueCommand(commandId: string): void {
    cachedIssues = [];
    registerCommand(commandId, async (context: types.IActionContext) => {
        context.errorHandling.suppressDisplay = true;
        context.errorHandling.suppressReportIssue = true;

        cachedIssues = nonNullValue(cachedIssues, 'cachedIssues');
        if (cachedIssues.length === 0) {
            await reportAnIssue(undefined);
        } else {
            const picks: types.IAzureQuickPickItem<IReportableIssue | undefined>[] = cachedIssues.reverse().map(i => {
                return {
                    label: i.error.message,
                    description: i.error.errorType,
                    detail: `${i.callbackId} - ${dayjs(i.time).fromNow()}`,
                    data: i
                };
            });
            picks.unshift({
                label: localize('emptyIssue', '$(keyboard) Manually enter error'),
                data: undefined
            });
            const placeHolder: string = localize('selectError', 'Select the error you would like to report');
            const issue: IReportableIssue | undefined = (await ext.ui.showQuickPick(picks, { placeHolder, suppressPersistence: true })).data;
            await reportAnIssue(issue);
        }
    });
}
