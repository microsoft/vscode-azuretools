/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OctoKit } from '../api/octokit'
import { Action } from '../common/Action'
import { getInput, getRequiredInput } from '../common/utils'
import { StaleCloser } from './StaleCloser'

class Stale extends Action {
	id = 'Stale'

	async onTriggered(github: OctoKit) {
		await new StaleCloser(
			github,
			+getRequiredInput('closeDays'),
			getRequiredInput('closeComment'),
			+getRequiredInput('warnDays'),
			getRequiredInput('warnComment'),
			+getRequiredInput('upvotesRequired'),
			+getRequiredInput('numCommentsOverride'),
			getRequiredInput('candidateMilestone'),
			getInput('labelsToExclude'),
			getInput('staleLabel'),
		).run()
	}
}

new Stale().run() // eslint-disable-line
