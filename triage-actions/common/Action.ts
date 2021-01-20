/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getInput, setFailed } from '@actions/core'
import { context } from '@actions/github'
import { v4 as uuid } from 'uuid'
import { OctoKit, OctoKitIssue } from '../api/octokit'
import { getRequiredInput } from './utils'

export abstract class Action {
	abstract id: string

	constructor() {
		console.log('::stop-commands::' + uuid())
	}

	public async run() {
		try {
			const token = getRequiredInput('token')
			const readonly = !/^(false|0)?$/i.test(getInput('readonly'))

			const issue = context?.issue?.number
			if (issue) {
				const octokit = new OctoKitIssue(token, context.repo, { number: issue }, { readonly })
				if (context.eventName === 'issue_comment') {
					await this.onCommented(octokit, context.payload.comment.body, context.actor)
				} else if (context.eventName === 'issues') {
					switch (context.payload.action) {
						case 'opened':
							await this.onOpened(octokit)
							break
						case 'reopened':
							await this.onReopened(octokit)
							break
						case 'closed':
							await this.onClosed(octokit)
							break
						case 'labeled':
							await this.onLabeled(octokit, context.payload.label.name)
							break
						case 'unassigned':
							await this.onUnassigned(octokit, context.payload.assignee.login)
							break
						case 'edited':
							await this.onEdited(octokit)
							break
						case 'milestoned':
							await this.onMilestoned(octokit)
							break
						default:
							throw Error('Unexpected action: ' + context.payload.action)
					}
				}
			} else {
				await this.onTriggered(new OctoKit(token, context.repo, { readonly }))
			}
		} catch (e) {
			setFailed(e.message)
		}
	}

	protected async onTriggered(_octokit: OctoKit): Promise<void> {
		throw Error('not implemented')
	}
	protected async onEdited(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented')
	}
	protected async onLabeled(_issue: OctoKitIssue, _label: string): Promise<void> {
		throw Error('not implemented')
	}
	protected async onUnassigned(_issue: OctoKitIssue, _label: string): Promise<void> {
		throw Error('not implemented')
	}
	protected async onOpened(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented')
	}
	protected async onReopened(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented')
	}
	protected async onClosed(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented')
	}
	protected async onMilestoned(_issue: OctoKitIssue): Promise<void> {
		throw Error('not implemented')
	}
	protected async onCommented(_issue: OctoKitIssue, _comment: string, _actor: string): Promise<void> {
		throw Error('not implemented')
	}
}
