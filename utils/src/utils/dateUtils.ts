/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace dateUtils {
    /**
     * Takes the start and end date duration and converts the value
     * to a formatted string with the minutes and seconds `e.g. 1m 12s`
     */
    export function getFormattedDurationInMinutesAndSeconds(start: Date, end: Date): string {
        const durationSeconds: number = Math.round((end.getTime() - start.getTime()) / 1000);

        const minutes: number = Math.floor(durationSeconds / 60);
        const seconds: number = durationSeconds - minutes * 60;
        return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
    }
}
