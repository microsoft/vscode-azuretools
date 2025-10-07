/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import dayjs from 'dayjs';
// eslint-disable-next-line import/no-internal-modules
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

export namespace dateTimeUtils {
    export function getFormattedDurationInMinutesAndSeconds(durationTime: number, units?: duration.DurationUnitType): string {
        return dayjs
            .duration(durationTime, units)
            .format('m[m] s[s]')
            .replace(/\b0m\b/, '')
            .trim();
    }
}
