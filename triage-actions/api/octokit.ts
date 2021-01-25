/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { GitHub as GitHubAPI } from '@actions/github'
import { Octokit } from '@octokit/rest'
import { safeLog } from '../common/utils'
import { Comment, GitHub, GitHubIssue, Issue, Query, User } from './api'

let numRequests = 0
export const getNumRequests = () => numRequests

export class OctoKit implements GitHub {
	private _octokit: GitHubAPI
	protected get octokit(): GitHubAPI {
		numRequests++
		return this._octokit
	}

	// when in readonly mode, record labels just-created so at to not throw unneccesary errors
	protected mockLabels: Set<string> = new Set()

	constructor(
		protected token: string,
		protected params: { repo: string; owner: string },
		protected options: { readonly: boolean } = { readonly: false },
	) {
		this._octokit = new GitHubAPI(token)
	}

	// TODO: just iterate over the issues in a page here instead of making caller do it
	async *query(query: Query): AsyncIterableIterator<GitHubIssue[]> {
		const q = query.q + ` repo:${this.params.owner}/${this.params.repo}`

		const options = this.octokit.search.issuesAndPullRequests.endpoint.merge({
			...query,
			q,
			per_page: 100,
			headers: { Accept: 'application/vnd.github.squirrel-girl-preview+json' },
		})

		let pageNum = 0

		const timeout = async () => {
			if (pageNum < 2) {
				/* pass */
			} else if (pageNum < 4) {
				await new Promise((resolve) => setTimeout(resolve, 10000))
			} else {
				await new Promise((resolve) => setTimeout(resolve, 30000))
			}
		}

		for await (const pageResponse of this.octokit.paginate.iterator(options)) {
			await timeout()
			numRequests++
			const page: Array<Octokit.SearchIssuesAndPullRequestsResponseItemsItem> = pageResponse.data
			safeLog(`Page ${++pageNum}: ${page.map(({ number }) => number).join(' ')}`)
			yield page.map(
				(issue) =>
					new OctoKitIssue(this.token, this.params, this.octokitIssueToIssue(issue), this.options),
			)
		}
	}

	protected octokitIssueToIssue(
		issue: Octokit.IssuesGetResponse | Octokit.SearchIssuesAndPullRequestsResponseItemsItem,
	): Issue {
		return {
			author: { name: issue.user.login, isGitHubApp: issue.user.type === 'Bot' },
			body: issue.body,
			number: issue.number,
			title: issue.title,
			labels: (issue.labels as Octokit.IssuesGetLabelResponse[]).map((label) => label.name),
			open: issue.state === 'open',
			locked: (issue as any).locked,
			numComments: issue.comments,
			reactions: (issue as any).reactions,
			assignee: issue.assignee?.login ?? (issue as any).assignees?.[0]?.login,
			milestoneId: issue.milestone?.number ?? null,
			milestone: issue.milestone?.title,
			createdAt: +new Date(issue.created_at),
			updatedAt: +new Date(issue.updated_at),
			closedAt: issue.closed_at ? +new Date((issue.closed_at as unknown) as string) : undefined,
		}
	}

	private writeAccessCache: Record<string, boolean> = {}
	async hasWriteAccess(user: User): Promise<boolean> {
		if (user.name in this.writeAccessCache) {
			safeLog('Got permissions from cache for ' + user)
			return this.writeAccessCache[user.name]
		}
		safeLog('Fetching permissions for ' + user)
		const permissions = (
			await this.octokit.repos.getCollaboratorPermissionLevel({
				...this.params,
				username: user.name,
			})
		).data.permission
		return (this.writeAccessCache[user.name] = permissions === 'admin' || permissions === 'write')
	}

	async repoHasLabel(name: string): Promise<boolean> {
		try {
			await this.octokit.issues.getLabel({ ...this.params, name })
			return true
		} catch (err) {
			if (err.status === 404) {
				return this.options.readonly && this.mockLabels.has(name)
			}
			throw err
		}
	}
}

export class OctoKitIssue extends OctoKit implements GitHubIssue {
	constructor(
		token: string,
		protected params: { repo: string; owner: string },
		private issueData: { number: number } | Issue,
		options: { readonly: boolean } = { readonly: false },
	) {
		super(token, params, options)
		safeLog('running bot on issue', issueData.number)
	}

	async closeIssue(): Promise<void> {
		safeLog('Closing issue ' + this.issueData.number)
		if (!this.options.readonly)
			await this.octokit.issues.update({
				...this.params,
				issue_number: this.issueData.number,
				state: 'closed',
			})
	}

	async lockIssue(): Promise<void> {
		safeLog('Locking issue ' + this.issueData.number)
		if (!this.options.readonly)
			await this.octokit.issues.lock({ ...this.params, issue_number: this.issueData.number })
	}

	async getIssue(): Promise<Issue> {
		if (isIssue(this.issueData)) {
			safeLog('Got issue data from query result ' + this.issueData.number)
			return this.issueData
		}

		safeLog('Fetching issue ' + this.issueData.number)
		const issue = (
			await this.octokit.issues.get({
				...this.params,
				issue_number: this.issueData.number,
				mediaType: { previews: ['squirrel-girl'] },
			})
		).data
		return (this.issueData = this.octokitIssueToIssue(issue))
	}

	async postComment(body: string): Promise<void> {
		safeLog(`Posting comment on ${this.issueData.number}`)
		if (!this.options.readonly)
			await this.octokit.issues.createComment({
				...this.params,
				issue_number: this.issueData.number,
				body,
			})
	}

	async deleteComment(id: number): Promise<void> {
		safeLog(`Deleting comment ${id} on ${this.issueData.number}`)
		if (!this.options.readonly)
			await this.octokit.issues.deleteComment({
				owner: this.params.owner,
				repo: this.params.repo,
				comment_id: id,
			})
	}

	async setMilestone(milestoneId: number) {
		safeLog(`Setting milestone for ${this.issueData.number} to ${milestoneId}`)
		if (!this.options.readonly)
			await this.octokit.issues.update({
				...this.params,
				issue_number: this.issueData.number,
				milestone: milestoneId,
			})
	}

	async *getComments(last?: boolean): AsyncIterableIterator<Comment[]> {
		safeLog('Fetching comments for ' + this.issueData.number)

		const response = this.octokit.paginate.iterator(
			this.octokit.issues.listComments.endpoint.merge({
				...this.params,
				issue_number: this.issueData.number,
				per_page: 100,
				...(last ? { per_page: 1, page: (await this.getIssue()).numComments } : {}),
			}),
		)

		for await (const page of response) {
			numRequests++
			yield (page.data as Octokit.IssuesListCommentsResponseItem[]).map((comment) => ({
				author: { name: comment.user.login, isGitHubApp: comment.user.type === 'Bot' },
				body: comment.body,
				id: comment.id,
				timestamp: +new Date(comment.created_at),
			}))
		}
	}

	async addLabel(name: string): Promise<void> {
		safeLog(`Adding label ${name} to ${this.issueData.number}`)
		if (!(await this.repoHasLabel(name))) {
			throw Error(`Action could not execute becuase label ${name} is not defined.`)
		}
		if (!this.options.readonly)
			await this.octokit.issues.addLabels({
				...this.params,
				issue_number: this.issueData.number,
				labels: [name],
			})
	}

	async removeLabel(name: string): Promise<void> {
		safeLog(`Removing label ${name} from ${this.issueData.number}`)
		try {
			if (!this.options.readonly)
				await this.octokit.issues.removeLabel({
					...this.params,
					issue_number: this.issueData.number,
					name,
				})
		} catch (err) {
			if (err.status === 404) {
				safeLog(`Label ${name} not found on issue`)
				return
			}
			throw err
		}
	}
}

function isIssue(object: any): object is Issue {
	const isIssue =
		'author' in object &&
		'body' in object &&
		'title' in object &&
		'labels' in object &&
		'open' in object &&
		'locked' in object &&
		'number' in object &&
		'numComments' in object &&
		'reactions' in object &&
		'milestoneId' in object

	return isIssue
}
