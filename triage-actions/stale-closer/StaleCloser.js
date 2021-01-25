"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("../common/utils");
exports.WARN_MARKER = '<!-- cf875a82-7fe9-4a1c-aaf3-c2cc1703df6c -->'; // do not change, this is how we find the comments the bot made when writing a warning message
exports.STALE_MARKER = '<!-- 22a51d4d-6881-47c9-8a03-83e12877da20 -->'; // do not change, this is how we find the comments the bot made when rejecting an issue
class StaleCloser {
    constructor(github, closeDays, closeComment, warnDays, warnComment, upvotesRequired, numCommentsOverride, candidateMilestone, labelsToExclude) {
        this.github = github;
        this.closeDays = closeDays;
        this.closeComment = closeComment;
        this.warnDays = warnDays;
        this.warnComment = warnComment;
        this.upvotesRequired = upvotesRequired;
        this.numCommentsOverride = numCommentsOverride;
        this.candidateMilestone = candidateMilestone;
        this.labelsToExclude = labelsToExclude;
    }
    async run() {
        let query = `is:open is:issue is:unlocked milestone:"${this.candidateMilestone}"`;
        const labelsList = (this.labelsToExclude || '')
            .split(',')
            .map((l) => l.trim())
            .filter((l) => !!l);
        for (const label of labelsList) {
            query += ` -label:"${label}"`;
        }
        for await (const page of this.github.query({ q: query })) {
            for (const issue of page) {
                const issueData = await issue.getIssue();
                if (issueData.open &&
                    !issueData.locked &&
                    !labelsList.some((l) => issueData.labels.includes(l)) &&
                    issueData.milestone === this.candidateMilestone) {
                    await this.actOn(issue, issueData);
                }
                else {
                    utils_1.safeLog('Query returned an invalid issue: ' + issueData.number);
                }
            }
        }
    }
    async actOn(issue, issueData) {
        if (issueData.reactions['+1'] >= this.upvotesRequired ||
            issueData.numComments >= this.numCommentsOverride) {
            utils_1.safeLog(`Issue #${issueData.number} has sufficient upvotes or commments. Ignoring.`);
        }
        else {
            let lastTimestamp = issueData.createdAt;
            let warnTimeStamp;
            for await (const page of issue.getComments()) {
                for (const comment of page) {
                    if (comment.body.includes(exports.WARN_MARKER)) {
                        warnTimeStamp = comment.timestamp;
                    }
                    else if (comment.timestamp > lastTimestamp) {
                        lastTimestamp = comment.timestamp;
                    }
                }
            }
            if (!warnTimeStamp) {
                if (utils_1.daysSince(lastTimestamp) > this.closeDays - this.warnDays) {
                    utils_1.safeLog(`Issue #${issueData.number} nearing stale`);
                    await issue.postComment(exports.WARN_MARKER + '\n' + this.warnComment);
                }
            }
            else if (utils_1.daysSince(warnTimeStamp) > this.warnDays) {
                utils_1.safeLog(`Issue #${issueData.number} is stale`);
                await issue.postComment(exports.STALE_MARKER + '\n' + this.closeComment);
                await issue.closeIssue();
            }
        }
    }
}
exports.StaleCloser = StaleCloser;
//# sourceMappingURL=StaleCloser.js.map