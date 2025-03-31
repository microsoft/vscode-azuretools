/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace dateUtils {
    /**
     * Takes the start and end date duration and converts the value
     * to a formatted string with the minutes and seconds `e.g. 1m 12s`
     */
    export function getDurationInMinutesAndSeconds(start: Date, end: Date): string {
        const durationMs: number = end.getTime() - start.getTime();
        const durationMinutes: number = Math.floor(durationMs / 60000);
        const durationSeconds: number = Math.floor((durationMs % 60000) / 1000);
        return durationMinutes ? `${durationMinutes}m ${durationSeconds}s` : `${durationSeconds}s`;
    }
}
