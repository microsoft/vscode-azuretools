/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TelemetryMeasurements, TelemetryProperties } from "..";
import { localize } from "./localize";

export interface IHasTelemetryInfo {
    telemetry?: {
        properties?: TelemetryProperties;
        metrics?: TelemetryMeasurements;
    };
}

export class UserCancelledError extends Error implements IHasTelemetryInfo {
    public telemetry?: {
        properties?: TelemetryProperties;
        metrics?: TelemetryMeasurements;
    };

    constructor() {
        super(localize('userCancelledError', 'Operation cancelled.'));
    }
}

export class NotImplementedError extends Error {
    constructor(methodName: string, obj: object) {
        super(localize('notImplementedError', '"{0}" is not implemented on "{1}".', methodName, obj.constructor.name));
    }
}

export class ArgumentError extends Error {
    constructor(obj: object) {
        super(localize('argumentError', 'Invalid {0}.', obj.constructor.name));
    }
}
