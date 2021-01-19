/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as core from '@actions/core'

export const getInput = (name: string) => core.getInput(name) || undefined
export const getRequiredInput = (name: string) => core.getInput(name, { required: true })

export const daysAgoToTimestamp = (days: number): number => +new Date(Date.now() - days * 24 * 60 * 60 * 1000)

export const daysAgoToHumanReadbleDate = (days: number) =>
	new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}\w$/, '')

export const safeLog = (message: string, ...args: any[]): void => {
	const clean = (val: any) => ('' + val).replace(/:|#/g, '')
	console.log(clean(message), ...args.map(clean))
}
