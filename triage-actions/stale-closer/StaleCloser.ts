/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub, GitHubIssue, Issue } from '../api/api'
import { daysSince, safeLog } from '../common/utils'

export const WARN_MARKER = '<!-- cf875a82-7fe9-4a1c-aaf3-c2cc1703df6c -->' // do not change, this is how we find the comments the bot made when writing a warning message
export const STALE_MARKER = '<!-- 22a51d4d-6881-47c9-8a03-83e12877da20 -->' // do not change, this is how we find the comments the bot made when rejecting an issue

export class StaleCloser {
	constructor(
		private github: GitHub,
		private closeDays: number,
		private closeComment: string,
		private warnDays: number,
		private warnComment: string,
		private upvotesRequired: number,
		private numCommentsOverride: number,
		private candidateMilestone: string,
		private labelsToExclude: string | undefined,
		private staleLabel: string | undefined,
	) {}

	async run() {
		let query = `is:open is:issue is:unlocked milestone:"${this.candidateMilestone}"`
		const labelsList: string[] = (this.labelsToExclude || '')
			.split(',')
			.map((l) => l.trim())
			.filter((l) => !!l)
		for (const label of labelsList) {
			query += ` -label:"${label}"`
		}

		for await (const page of this.github.query({ q: query })) {
			for (const issue of page) {
				const issueData = await issue.getIssue()

				if (
					issueData.open &&
					!issueData.locked &&
					!labelsList.some((l) => issueData.labels.includes(l)) &&
					issueData.milestone === this.candidateMilestone
				) {
					await this.actOn(issue, issueData)
				} else {
					safeLog('Query returned an invalid issue: ' + issueData.number)
				}
			}
		}
	}

	private async actOn(issue: GitHubIssue, issueData: Issue): Promise<void> {
		if (
			issueData.reactions['+1'] >= this.upvotesRequired ||
			issueData.numComments >= this.numCommentsOverride
		) {
			safeLog(`Issue #${issueData.number} has sufficient upvotes or commments. Ignoring.`)
		} else {
			let lastTimestamp: number = issueData.createdAt
			let warnTimeStamp: number | undefined
			for await (const page of issue.getComments()) {
				for (const comment of page) {
					if (comment.body.includes(WARN_MARKER)) {
						warnTimeStamp = comment.timestamp
					} else if (comment.timestamp > lastTimestamp) {
						lastTimestamp = comment.timestamp
					}
				}
			}

			if (!warnTimeStamp) {
				if (daysSince(lastTimestamp) > this.closeDays - this.warnDays) {
					safeLog(`Issue #${issueData.number} nearing stale`)
					await issue.postComment(WARN_MARKER + '\n' + this.warnComment)
				}
			} else if (daysSince(warnTimeStamp) > this.warnDays) {
				safeLog(`Issue #${issueData.number} is stale`)
				await issue.postComment(STALE_MARKER + '\n' + this.closeComment)
				await issue.closeIssue()
				if (this.staleLabel) {
					await issue.addLabel(this.staleLabel)
				}
			}
		}
	}
}
