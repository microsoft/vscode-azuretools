/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dayjs from 'dayjs';
// eslint-disable-next-line import/no-internal-modules
import * as duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export namespace dateUtils {
    /**
     * Takes the start and end date duration and converts the value
     * to a formatted string with the minutes and seconds `e.g. 1m 12s`
     */
    export function getFormattedDurationInMinutesAndSeconds(start: Date, end: Date): string {
        const d: duration.Duration = dayjs.duration(end.getTime() - start.getTime());
        return `${d.minutes()}m ${d.seconds()}s`
            .replace(/\b0m\b/, '')
            .replace(/\b0s\b/, '');
    }
}
