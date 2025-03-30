/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export namespace dateUtils {
    /**
     * Takes the start and end date duration and converts the value
     * to a formatted string with the minutes and seconds `e.g. 01m 12s`
     */
    export function getDurationInMinutesAndSeconds(start: Date, end: Date): string {
        const durationMs: number = end.getTime() - start.getTime();
        const durationMinutes: number = Math.floor(durationMs / 60000);
        const durationSeconds: number = Math.floor((durationMs % 60000) / 1000);
        return `${pad(durationMinutes)}m ${pad(durationSeconds)}s`;
    }

    /**
     * Returns the clock time component from a supplied date value
     * in 12 hour time format `(AM/PM)`
     */
    export function get12HourTimeFormatted(date: Date): string {
        const hours: number = date.getHours();
        const ampm: string = hours < 12 ? 'AM' : 'PM';
        const formattedHours: number = hours % 12 || 12; // 0 and 24 need to show up as 12 for AM/PM format
        return `${pad(formattedHours)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
    }

    /**
     * Returns the clock time component from a supplied date value
     * in 24 hour time format
     */
    export function get24HourTimeFormatted(date: Date): string {
        return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }

    function pad(value: number): string {
        return value.toString().padStart(2, '0');
    }
}
