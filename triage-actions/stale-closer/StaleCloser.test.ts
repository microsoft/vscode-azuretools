/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { expect } from 'chai'
import { Comment } from '../api/api'
import { Testbed, TestbedIssue, TestbedIssueConstructorArgs } from '../api/testbed'
import { daysAgoToTimestamp } from '../common/utils'
import { StaleCloser, STALE_MARKER, WARN_MARKER } from './StaleCloser'

const initalizeTestbed = (
	issueConfig: TestbedIssueConstructorArgs,
	comments?: { body: string; daysAgo: number }[],
): { testbed: Testbed; issueTestbed: TestbedIssue } => {
	const issue = new TestbedIssue(
		{},
		{
			issue: Object.assign(
				{ createdAt: daysAgoToTimestamp(10), updatedAt: daysAgoToTimestamp(10) },
				issueConfig.issue,
			),
			labels: issueConfig.labels,
			upvotes: issueConfig.upvotes,
			comments: (comments || []).map((comment, index) => ({
				author: { name: 'rando' },
				body: comment.body,
				id: index,
				timestamp: daysAgoToTimestamp(comment.daysAgo),
			})),
		},
	)

	return {
		testbed: new Testbed({
			queryRunner: async function* () {
				yield [issue]
			},
		}),
		issueTestbed: issue,
	}
}

const getAllComments = async (issue: TestbedIssue): Promise<Comment[]> => {
	const comments = []
	for await (const page of issue.getComments()) comments.push(...page)
	return comments
}

const testConfig: [number, string, number, string, number, number, string, string] = [
	6,
	'staleComment',
	2,
	'warnComment',
	7,
	4,
	'backlog candidates',
	'P0,P1',
]

describe('StaleCloser', () => {
	describe('Warning', () => {
		it('Adds a warning to issue which is nearing closure', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: { milestone: 'backlog candidates' },
			})
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
			expect((await getAllComments(issueTestbed))[0].body).contains(WARN_MARKER)
			expect((await getAllComments(issueTestbed))[0].body).contains('warnComment')
		})

		it('Does not warn if the issue is closed', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: { open: false, milestone: 'backlog candidates' },
			})
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(0)
		})

		it('Does not warn if the issue is not in the candidate milestone', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: {},
			})
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(0)
		})

		it('Does not warn if the issue has enough upvotes', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: { milestone: 'backlog candidates' },
				upvotes: 7,
			})
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(0)
			expect(issueTestbed.issueConfig.issue.open).true
		})

		it('Does not warn if the issue has enough comments', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
				},
				[
					{ body: 'comment1', daysAgo: 6 },
					{ body: 'comment2', daysAgo: 5.7 },
					{ body: 'comment3', daysAgo: 5.5 },
					{ body: 'comment4', daysAgo: 5.3 },
				],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(4)
		})

		it('Does not warn if the issue has excluded label', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: { milestone: 'backlog candidates' },
				labels: ['P1'],
			})
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(0)
		})

		it('Does not double add a warning comment', async () => {
			const { testbed, issueTestbed } = initalizeTestbed({
				issue: { milestone: 'backlog candidates' },
			})
			await new StaleCloser(testbed, ...testConfig).run()
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
			expect((await getAllComments(issueTestbed))[0].body).contains(WARN_MARKER)
			expect((await getAllComments(issueTestbed))[0].body).contains('warnComment')
		})
	})

	describe('Closing', () => {
		it('Closes & rejects issue which has not recieved enough upvotes', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(2)
			expect((await getAllComments(issueTestbed))[1].body).contains(STALE_MARKER)
			expect((await getAllComments(issueTestbed))[1].body).contains('staleComment')
			expect(issueTestbed.issueConfig.issue.open).false
		})

		it('Closes issue only after the proper days have passed since warning', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 1 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
			expect(issueTestbed.issueConfig.issue.open).true
		})

		it('Does not close if the issue is already closed', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { open: false, milestone: 'backlog candidates' },
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
		})

		it('Does not close if the issue is not in the candidate milestone', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: {},
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
		})

		it('Does not close issue which has enough upvotes', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
					upvotes: 7,
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
			expect(issueTestbed.issueConfig.issue.open).true
		})

		it('Does not close issue which has enough comments', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
				},
				[
					{ body: WARN_MARKER + 'warnComment', daysAgo: 6 },
					{ body: 'comment2', daysAgo: 5.7 },
					{ body: 'comment3', daysAgo: 5.5 },
					{ body: 'comment4', daysAgo: 5.3 },
				],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(4)
			expect(issueTestbed.issueConfig.issue.open).true
		})

		it('Does not close if the issue has excluded label', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
					labels: ['P1'],
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(1)
			expect(issueTestbed.issueConfig.issue.open).true
		})

		it('Does not double add a close comment', async () => {
			const { testbed, issueTestbed } = initalizeTestbed(
				{
					issue: { milestone: 'backlog candidates' },
				},
				[{ body: WARN_MARKER + 'warnComment', daysAgo: 6 }],
			)
			await new StaleCloser(testbed, ...testConfig).run()
			await new StaleCloser(testbed, ...testConfig).run()
			expect((await getAllComments(issueTestbed)).length).equal(2)
			expect((await getAllComments(issueTestbed))[1].body).contains(STALE_MARKER)
			expect((await getAllComments(issueTestbed))[1].body).contains('staleComment')
			expect(issueTestbed.issueConfig.issue.open).false
		})
	})
})
