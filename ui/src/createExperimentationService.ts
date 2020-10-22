/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as tas from 'vscode-tas-client';
import { IActionContext, IExperimentationServiceAdapter } from '../index';
import { IInternalTelemetryReporter } from './createTelemetryReporter';
import { ext } from './extensionVariables';
import { getPackageInfo } from './getPackageInfo';
import { registerTelemetryHandler } from './index';

export async function createExperimentationService(ctx: vscode.ExtensionContext, targetPopulation?: tas.TargetPopulation): Promise<IExperimentationServiceAdapter> {
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

    return result;
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

    public getCachedTreatmentVariable<T extends string | number | boolean>(name: string): T | undefined {
        if (!this.wrappedExperimentationService) {
            return undefined;
        }

        return this.wrappedExperimentationService.getTreatmentVariable('vscode', name);
    }

    public async getLiveTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined> {
        if (!this.wrappedExperimentationService) {
            return undefined;
        }

        return this.wrappedExperimentationService.getTreatmentVariableAsync('vscode', name);
    }
}

class ExperimentationTelemetry implements tas.IExperimentationTelemetry {
    private readonly sharedProperties: { [key: string]: string } = {};

    public constructor(private readonly telemetryReporter: IInternalTelemetryReporter, context: vscode.ExtensionContext) {
        context.subscriptions.push(registerTelemetryHandler((actionContext: IActionContext) => this.handleTelemetry(actionContext)));
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

        Object.assign(properties, this.sharedProperties);

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
     * @param actionContext The action context
     */
    public handleTelemetry(actionContext: IActionContext): void {
        Object.assign(actionContext.telemetry.properties, this.sharedProperties);
    }
}
