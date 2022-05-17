/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as types from '../index';
import { TestUserInput } from './TestUserInput';

export async function createTestActionContext(): Promise<types.TestActionContext> {
    return { telemetry: { properties: {}, measurements: {} }, errorHandling: { issueProperties: {} }, valuesToMask: [], ui: await TestUserInput.create() };
}

/**
 * Similar to `createTestActionContext` but with some extra logging
 */
export async function runWithTestActionContext(callbackId: string, callback: (context: types.TestActionContext) => Promise<void>): Promise<void> {
    const context = await createTestActionContext();
    const start: number = Date.now();
    try {
        await callback(context);
    } finally {
        const end: number = Date.now();
        context.telemetry.measurements.duration = (end - start) / 1000;
        console.log(`** TELEMETRY(${callbackId}) properties=${JSON.stringify(context.telemetry.properties)}, measurements=${JSON.stringify(context.telemetry.measurements)}`);
    }
}
