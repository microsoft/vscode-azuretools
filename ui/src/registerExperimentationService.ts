/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as tas from 'vscode-tas-client';
import { IActionContext, IExperimentationServiceAdapter, registerTelemetryHandler } from '../index';
import { IInternalTelemetryReporter } from './createTelemetryReporter';
import { ext } from './extensionVariables';
import { getPackageInfo } from './getPackageInfo';

export async function registerExperimentationService(ctx: vscode.ExtensionContext, targetPopulation?: tas.TargetPopulation): Promise<void> {
    const result: ExperimentationServiceAdapter = new ExperimentationServiceAdapter();
    const { extensionId, extensionVersion } = getPackageInfo(ctx);

    if (vscode.workspace.getConfiguration('telemetry').get('enableTelemetry', false)) {
        try {
            result.wrappedExperimentationService = await tas.getExperimentationServiceAsync(
                extensionId,
                extensionVersion,
                targetPopulation ?? (/alpha/ig.test(extensionVersion) ? tas.TargetPopulation.Insiders : tas.TargetPopulation.Public),
                new ExperimentationTelemetry(ext._internalReporter, ctx),
                ctx.globalState
            );
        } catch {
            // Best effort
        }
    }

    ext.experimentationService = result;
}

class ExperimentationServiceAdapter implements IExperimentationServiceAdapter {
    public wrappedExperimentationService?: tas.IExperimentationService;

    public async isCachedFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return this.wrappedExperimentationService.isCachedFlightEnabled(flight);
    }

    public async isLiveFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return this.wrappedExperimentationService.isFlightEnabledAsync(flight);
    }
}

class ExperimentationTelemetry implements tas.IExperimentationTelemetry {
    private readonly sharedProperties: { [key: string]: string } = {};

    public constructor(private readonly telemetryReporter: IInternalTelemetryReporter, context: vscode.ExtensionContext) {
        context.subscriptions.push(registerTelemetryHandler((context: IActionContext) => this.handleTelemetry(context)));
    }

    /**
     * Implements `postEvent` for `IExperimentationTelemetry`.
     * @param eventName The name of the event
     * @param props The properties to attach to the event
     */
    public postEvent(eventName: string, props: Map<string, string>): void {
        const properties: { [key: string]: string } = {};

        for (const key of props.keys()) {
            properties[key] = <string>props.get(key);
        }

        this.telemetryReporter.sendTelemetryErrorEvent(eventName, properties);
    }

    /**
     * Implements `setSharedProperty` for `IExperimentationTelemetry`
     * @param name The name of the property
     * @param value The value of the property
     */
    public setSharedProperty(name: string, value: string): void {
        this.sharedProperties[name] = value;
    }

    /**
     * Implements a telemetry handler that adds the shared properties to the event
     * @param context The action context
     */
    public handleTelemetry(context: IActionContext): void {
        context.telemetry.properties = {
            ...context.telemetry.properties,
            ...this.sharedProperties
        };
    }
}
