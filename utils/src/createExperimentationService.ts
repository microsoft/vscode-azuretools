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

    if (targetPopulation === undefined) {
        if (ctx.extensionMode !== vscode.ExtensionMode.Production) {
            // Extension is being debugged
            targetPopulation = tas.TargetPopulation.Team;
        } else if (/alpha/ig.test(extensionVersion)) {
            // Extension version has "alpha"
            targetPopulation = tas.TargetPopulation.Insiders;
        } else if (/Insiders/ig.test(vscode.env.appName)) {
            // Running in VSCode Insiders
            targetPopulation = tas.TargetPopulation.Insiders;
        } else {
            targetPopulation = tas.TargetPopulation.Public;
        }
    }

    try {
        result.wrappedExperimentationService = await tas.getExperimentationServiceAsync(
            extensionId,
            extensionVersion,
            targetPopulation,
            new ExperimentationTelemetry(ext._internalReporter, ctx),
            ctx.globalState
        );
    } catch {
        // Best effort
    }

    return result;
}

class ExperimentationServiceAdapter implements IExperimentationServiceAdapter {
    public wrappedExperimentationService?: tas.IExperimentationService;

    /**
     * @deprecated Use `getCachedTreatmentVariable<boolean>('flight-name') instead
     */
    public async isCachedFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return !!(await this.getCachedTreatmentVariable<boolean>(flight));
    }

    /**
     * @deprecated Use `getLiveTreatmentVariable<boolean>('flight-name') instead
     */
    public async isLiveFlightEnabled(flight: string): Promise<boolean> {
        if (!this.wrappedExperimentationService) {
            return false;
        }

        return !!(await this.getLiveTreatmentVariable<boolean>(flight));
    }

    public async getCachedTreatmentVariable<T extends string | number | boolean>(name: string): Promise<T | undefined> {
        if (!this.wrappedExperimentationService) {
            return Promise.resolve(undefined);
        }

        return Promise.resolve(this.wrappedExperimentationService.getTreatmentVariable<T>('vscode', name));
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

        // Treat the TAS query event as activation
        if (/query-expfeature/i.test(eventName)) {
            properties.isActivationEvent = 'true';
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
     * @param actionContext The action context
     */
    public handleTelemetry(actionContext: IActionContext): void {
        Object.assign(actionContext.telemetry.properties, this.sharedProperties);
    }
}
