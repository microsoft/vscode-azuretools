/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AsyncLocalStorage } from 'async_hooks';
import { performance } from 'perf_hooks';
import { CancellationError } from 'vscode';
import type * as types from '../index';
import { isUserCancelledError } from './errors';
import { ext } from './extensionVariables';
import { crypto } from './node/crypto';

const workflows = ['createProject', 'createFunction', 'deploy', 'unknown'] as const;
const commands = ['createNewProject', 'createNewProjectWithDockerfile', 'templateGallery.createProject', 'createFunction', 'deploy', 'deployProject', 'deploySlot', 'redeploy', 'deployByFunctionAppId', 'unknown'] as const;
const stages = ['prompt', 'execute', 'prerequisites', 'projectCreation', 'functionCreation', 'preDeployTask', 'deployment', 'upload', 'acceptance', 'polling', 'completion', 'triggerSync', 'postDeployTask', 'unknown'] as const;
const outcomes = ['succeeded', 'failed', 'canceled', 'handedOff', 'blocked', 'unknown'] as const;
const cancelReasons = ['userDismissed', 'templateGallery', 'prerequisite', 'preDeployTask', 'unknown'] as const;
const failureCategories = ['prerequisite', 'task', 'deployment', 'authentication', 'authorization', 'throttled', 'service', 'network', 'unknown'] as const;
const failureCodes = ['coreToolsUnavailable', 'goUnavailable', 'preDeployTaskMissing', 'preDeployTaskFailed', 'funcCliFailed', 'deploymentFailed', 'deploymentCanceled', 'deploymentSuperseded', 'deploymentPartial', 'deploymentStatusUnavailable', 'githubDeploymentRequired', 'triggerDiscoveryFailed', 'timeout', 'dns', 'connection', 'tls', 'aborted', 'httpUnauthorized', 'httpForbidden', 'httpNotFound', 'httpConflict', 'httpThrottled', 'httpServerError', 'unknown'] as const;
const mechanisms = ['zip', 'war', 'flex', 'storage', 'localGit', 'github', 'funccli', 'unknown'] as const;
const statuses = ['accepted', 'running', 'succeeded', 'failed', 'canceled', 'partial', 'unknown'] as const;
const networkCategories = ['timeout', 'dns', 'connection', 'tls', 'aborted', 'unknown'] as const;

interface Interval { start: number; end?: number }
interface Frame {
    id: string;
    parentId?: string;
    stage?: types.WorkflowStage;
    start: number;
    end?: number;
    outcome?: types.WorkflowOutcome;
    details: types.WorkflowTelemetryDetails;
    retryCount?: number;
    recovered?: boolean;
    stepId?: string;
    retriedFailure?: boolean;
}
interface Root {
    workflow: types.WorkflowName;
    command: types.WorkflowCommand;
    id: string;
    frame: Frame;
    steps: Set<string>;
    waits: Interval[];
    retryCount?: number;
    recovered?: boolean;
    failedAttempts: Map<string, Set<number>>;
    lastFailure?: string;
    retryTargets: Set<string>;
}
interface Action {
    root: Root;
    frame: Frame;
    isRoot: boolean;
    stepId?: string;
    lastStep?: string;
    waits: Interval[];
}
interface Scope { action: Action; frame: Frame; parent?: Scope }
const actions = new WeakMap<types.ITelemetryContext, Action>();
const scopes = new AsyncLocalStorage<Scope>();

function bounded<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
    return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback;
}

function newFrame(parentId?: string, stage?: types.WorkflowStage): Frame {
    return { id: crypto.randomUUID(), parentId, stage, start: performance.now(), details: {} };
}

export function initializeWorkflowTelemetry(context: types.IActionContext, options: types.WorkflowTelemetryOptions, parentContext?: types.IActionContext): void {
    let action = actions.get(context.telemetry);
    if (!action) {
        const parent = parentContext && actions.get(parentContext.telemetry);
        const activeScope = scopes.getStore();
        const frame = newFrame(parent ? (activeScope?.action === parent ? activeScope.frame.id : parent.frame.id) : undefined);
        const root: Root = parent?.root ?? {
            workflow: bounded(options.workflow, workflows, 'unknown'),
            command: bounded(options.command, commands, 'unknown'),
            id: crypto.randomUUID(), frame, steps: new Set(), waits: [], failedAttempts: new Map(), retryTargets: new Set()
        };
        action = { root, frame, isRoot: !parent, waits: root.frame.end === undefined ? root.waits : [] };
        actions.set(context.telemetry, action);
        const payload = createPayload(action, frame);
        Object.assign(context.telemetry.properties, payload.properties);
        Object.assign(context.telemetry.measurements, payload.measurements, { workflowDuration: undefined, activeDuration: undefined, userWaitDuration: undefined });
    }
    registerWorkflowStepNames(context, options.stepNames ?? []);
}

export function registerWorkflowStepNames(context: types.IActionContext, names: readonly string[]): void {
    const steps = actions.get(context.telemetry)?.root.steps;
    for (const name of names.slice(0, 128)) {
        if (steps && steps.size < 128 && /^[a-zA-Z][a-zA-Z0-9._-]{0,63}$/.test(name) && !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(name)) {
            steps.add(name);
        }
    }
}

function currentScope(action: Action): Scope | undefined {
    const scope = scopes.getStore();
    return scope?.action === action && scope.frame.end === undefined ? scope : undefined;
}

export function setWorkflowOutcome(context: types.IActionContext, outcome: types.WorkflowOutcome, details: types.WorkflowTelemetryDetails = {}): void {
    const action = actions.get(context.telemetry);
    if (action && action.frame.end === undefined) {
        action.frame.outcome = bounded(outcome, outcomes, 'unknown');
        action.frame.details = { ...action.frame.details, ...sanitizeDetails(details) };
    }
}

function sanitizeDetails(details: types.WorkflowTelemetryDetails): types.WorkflowTelemetryDetails {
    return {
        ...(details.cancelReason === undefined ? {} : { cancelReason: bounded(details.cancelReason, cancelReasons, 'unknown') }),
        ...(details.failureCategory === undefined ? {} : { failureCategory: bounded(details.failureCategory, failureCategories, 'unknown') }),
        ...(details.failureCode === undefined ? {} : { failureCode: bounded(details.failureCode, failureCodes, 'unknown') }),
        ...(typeof details.retryable === 'boolean' ? { retryable: details.retryable } : {}),
        ...(details.deploymentMechanism === undefined ? {} : { deploymentMechanism: bounded(details.deploymentMechanism, mechanisms, 'unknown') }),
        ...(details.deploymentStatus === undefined ? {} : { deploymentStatus: bounded(details.deploymentStatus, statuses, 'unknown') }),
        ...(details.networkCategory === undefined ? {} : { networkCategory: bounded(details.networkCategory, networkCategories, 'unknown') }),
        ...(Number.isInteger(details.httpStatus) && Number(details.httpStatus) >= 100 && Number(details.httpStatus) <= 599 ? { httpStatus: details.httpStatus } : {})
    };
}

export function setWorkflowTelemetryDetails(context: types.IActionContext, details: types.WorkflowTelemetryDetails): void {
    const action = actions.get(context.telemetry);
    if (action && action.frame.end === undefined) {
        const frame = currentScope(action)?.frame ?? action.frame;
        const sanitized = sanitizeDetails(details);
        Object.assign(frame.details, sanitized);
        for (const target of [action.frame, ...(action.root.frame.end === undefined ? [action.root.frame] : [])]) {
            if (sanitized.deploymentMechanism !== undefined) {
                target.details.deploymentMechanism = sanitized.deploymentMechanism;
            }
            if (sanitized.deploymentStatus !== undefined) {
                target.details.deploymentStatus = sanitized.deploymentStatus;
            }
        }
    }
}

export function recordWorkflowRetry(context: types.IActionContext): void {
    const action = actions.get(context.telemetry);
    if (action && action.frame.end === undefined) {
        if (action.root.frame.end === undefined) {
            action.root.retryCount = (action.root.retryCount ?? 0) + 1;
        }
        if (action.root.lastFailure) {
            const scope = currentScope(action);
            if (scope && `${scope.frame.parentId}:${scope.frame.stage}` === action.root.lastFailure) {
                scope.frame.retriedFailure = true;
            } else {
                action.root.retryTargets.add(action.root.lastFailure);
            }
            if (action.root.frame.end === undefined) {
                action.root.recovered ??= false;
            }
            action.frame.recovered ??= false;
        }
        action.frame.retryCount = (action.frame.retryCount ?? 0) + 1;
        for (let scope = currentScope(action); scope; scope = scope.parent) {
            scope.frame.retryCount = (scope.frame.retryCount ?? 0) + 1;
        }
    }
}

export function startWorkflowUserWait(context: types.IActionContext): types.WorkflowUserWaitTimer {
    const action = actions.get(context.telemetry);
    const interval: Interval = { start: performance.now() };
    if (action && action.frame.end === undefined) {
        if (action.root.frame.end !== undefined && action.waits === action.root.waits) {
            action.waits = action.waits.slice();
        }
        action.waits.push(interval);
    }
    return { dispose: (): void => { interval.end ??= performance.now(); } };
}

export async function withTelemetryStage<T>(context: types.IActionContext, options: { stage: types.WorkflowStage; attempt?: number }, callback: (stage: types.WorkflowTelemetryStage) => Promise<T>): Promise<T> {
    const action = actions.get(context.telemetry);
    if (!action || action.frame.end !== undefined) {
        return await callback({ setOutcome: (): void => { /* no opt-in */ } });
    }
    const parent = currentScope(action);
    const frame = newFrame(parent?.frame.id ?? action.frame.id, bounded(options.stage, stages, 'unknown'));
    frame.stepId = action.stepId;
    const attempt = Number.isSafeInteger(options.attempt) && Number(options.attempt) > 0 ? options.attempt : undefined;
    const key = `${frame.parentId}:${frame.stage}`;
    if (attempt === 1) {
        action.root.failedAttempts.delete(key);
        action.root.retryTargets.delete(key);
        if (action.root.lastFailure === key) {
            action.root.lastFailure = undefined;
        }
    }
    if (attempt !== undefined) {
        if (action.root.frame.end === undefined) {
            action.root.retryCount ??= 0;
        }
        action.frame.retryCount ??= 0;
        frame.retryCount = 0;
        if (attempt > 1) {
            recordWorkflowRetry(context);
            frame.retryCount = 1;
        }
    }
    const retryingFailedStage = action.root.retryTargets.delete(key);
    if (retryingFailedStage && frame.retryCount === undefined) {
        frame.retryCount = 1;
    }
    const handle: types.WorkflowTelemetryStage = {
        setOutcome: (outcome, details = {}): void => {
            frame.outcome = bounded(outcome, outcomes, 'unknown');
            Object.assign(frame.details, sanitizeDetails(details));
        }
    };
    try {
        const result = await scopes.run({ action, frame, parent }, () => callback(handle));
        frame.outcome ??= 'succeeded';
        return result;
    } catch (error) {
        if (!frame.outcome || frame.outcome === 'succeeded' || frame.outcome === 'unknown') {
            frame.outcome = action.frame.outcome === 'handedOff' || action.frame.outcome === 'blocked' || action.frame.outcome === 'failed' ?
                action.frame.outcome : isUserCancelledError(error) || error instanceof CancellationError ? 'canceled' : 'failed';
        }
        frame.details = { ...(frame.outcome === 'failed' ? classifyWorkflowError(error) : {}), ...action.frame.details, ...frame.details };
        throw error;
    } finally {
        frame.end = performance.now();
        if (frame.outcome === 'failed' || frame.outcome === 'blocked') {
            action.root.lastFailure = key;
        } else if (frame.outcome === 'succeeded' && (retryingFailedStage || frame.retriedFailure)) {
            frame.recovered = true;
            action.frame.recovered = true;
            if (action.root.frame.end === undefined) {
                action.root.recovered = true;
            }
            action.root.lastFailure = undefined;
        }
        if (attempt !== undefined) {
            if (frame.outcome === 'failed') {
                const failed = action.root.failedAttempts.get(key) ?? new Set<number>();
                failed.add(attempt);
                action.root.failedAttempts.set(key, failed);
            } else if (frame.outcome === 'succeeded' && attempt > 1) {
                if (retryingFailedStage || frame.retriedFailure || [...(action.root.failedAttempts.get(key) ?? [])].some(previous => previous < attempt)) {
                    frame.recovered = true;
                    action.frame.recovered = true;
                    if (action.root.frame.end === undefined) {
                        action.root.recovered = true;
                    }
                }
            }
        }
        sendStage(context, action, frame);
    }
}

/** Classify structured signals only. Never read or emit messages, URLs, response bodies or arbitrary codes. */
export function classifyWorkflowError(error: unknown): types.WorkflowTelemetryDetails {
    if (!error || typeof error !== 'object') {
        return { failureCategory: 'unknown', failureCode: 'unknown' };
    }
    const code = 'code' in error ? error.code : 'errorType' in error ? error.errorType : undefined;
    const status = 'statusCode' in error ? error.statusCode : 'status' in error ? error.status : undefined;
    const network = new Map<unknown, types.WorkflowNetworkCategory>([
        ['ETIMEDOUT', 'timeout'], ['ESOCKETTIMEDOUT', 'timeout'], ['ENOTFOUND', 'dns'], ['EAI_AGAIN', 'dns'],
        ['ECONNRESET', 'connection'], ['ECONNREFUSED', 'connection'], ['EPIPE', 'connection'],
        ['CERT_HAS_EXPIRED', 'tls'], ['DEPTH_ZERO_SELF_SIGNED_CERT', 'tls'], ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'tls'],
        ['REQUEST_ABORTED_ERROR', 'aborted'], ['ABORT_ERR', 'aborted']
    ]).get(code);
    const rawStatus = status ?? code;
    const numericStatus = typeof rawStatus === 'number' ? rawStatus :
        typeof rawStatus === 'string' && /^[1-5]\d\d$/.test(rawStatus) ? Number(rawStatus) : undefined;
    const httpStatus = Number.isInteger(numericStatus) && Number(numericStatus) >= 100 && Number(numericStatus) <= 599 ? numericStatus : undefined;
    if (network) {
        return sanitizeDetails({ httpStatus, failureCategory: 'network', failureCode: network, networkCategory: network });
    }
    const httpCodes = new Map<number, [types.WorkflowFailureCategory, types.WorkflowFailureCode]>([
        [401, ['authentication', 'httpUnauthorized']], [403, ['authorization', 'httpForbidden']],
        [404, ['deployment', 'httpNotFound']], [409, ['deployment', 'httpConflict']], [429, ['throttled', 'httpThrottled']]
    ]);
    const classification = httpStatus === undefined ? undefined : httpCodes.get(httpStatus);
    return sanitizeDetails({
        httpStatus,
        failureCategory: classification?.[0] ?? (httpStatus && httpStatus >= 500 ? 'service' : 'unknown'),
        failureCode: classification?.[1] ?? (httpStatus && httpStatus >= 500 ? 'httpServerError' : 'unknown')
    });
}

export function setTelemetryStep(context: types.IActionContext, name: string | undefined, fallback: string, prefix: string = ''): string {
    const action = actions.get(context.telemetry);
    const safeFallback = action?.root.steps.has(fallback) || ['unknown', 'quickPick', 'inputBox', 'openDialog', 'WorkspaceFolderPick', 'warningMessage'].includes(fallback) ? fallback : 'unknown';
    const step = name && action?.root.steps.has(name) ? name : safeFallback;
    context.telemetry.properties.lastStep = `${prefix}${step}`;
    if (action) {
        action.stepId = step;
        action.lastStep = context.telemetry.properties.lastStep;
        const scope = currentScope(action);
        if (scope) {
            scope.frame.stepId = step;
        }
    }
    return step;
}

export function setErrorTelemetryStep(context: types.IActionContext, name: string): void {
    const action = actions.get(context.telemetry);
    const previous = context.telemetry.properties.lastStep;
    if (action?.root.steps.has(name)) {
        setTelemetryStep(context, name, 'unknown');
    } else if (!action?.lastStep && !(typeof previous === 'string' && ['quickPick', 'inputBox', 'openDialog', 'WorkspaceFolderPick', 'warningMessage', 'prompt-unknown', 'execute-unknown'].includes(previous))) {
        setTelemetryStep(context, undefined, 'unknown');
    }
    // Error metadata is not a trusted step registry and cannot overwrite a known wizard/UI step.
}

export function recordWorkflowError(context: types.IActionContext, error: unknown, canceled: boolean): void {
    const action = actions.get(context.telemetry);
    if (action && action.frame.end === undefined) {
        if (!action.frame.outcome || action.frame.outcome === 'unknown' || action.frame.outcome === 'succeeded') {
            action.frame.outcome = canceled ? 'canceled' : 'failed';
        }
        if (!canceled) {
            action.frame.details = { ...classifyWorkflowError(error), ...action.frame.details };
        }
    }
}

export function recordWorkflowUserDismissal(context: types.IActionContext): void {
    const action = actions.get(context.telemetry);
    if (action && action.frame.end === undefined) {
        action.frame.details.cancelReason ??= 'userDismissed';
    }
}

export function finalizeWorkflowTelemetry(context: types.IActionContext, failed?: boolean, canceled?: boolean): void {
    const action = actions.get(context.telemetry);
    if (!action) {
        return;
    }
    action.frame.outcome ??= canceled ? 'canceled' : failed ? 'failed' : 'succeeded';
    if (canceled && action.frame.outcome === 'canceled') {
        action.frame.details.cancelReason ??= 'unknown';
    }
    action.frame.end ??= performance.now();
    const payload = createPayload(action, action.frame);
    Object.assign(context.telemetry.properties, payload.properties);
    Object.assign(context.telemetry.measurements, payload.measurements);
    if (action.lastStep) {
        context.telemetry.properties.lastStep = action.lastStep;
    }
}

function createPayload(action: Action, frame: Frame): { properties: types.TelemetryProperties; measurements: types.TelemetryMeasurements } {
    const end = frame.end ?? performance.now();
    const duration = Math.max(0, end - frame.start);
    const intervals = action.waits.map(wait => ({
        start: Math.max(frame.start, wait.start), end: Math.min(end, wait.end ?? end)
    })).filter(wait => wait.end > wait.start).sort((a, b) => a.start - b.start);
    const waitObserved = action.waits.some(wait => wait.start <= end && (wait.end ?? end) >= frame.start);
    let userWait = 0;
    let lastEnd = frame.start;
    for (const interval of intervals) {
        userWait += Math.max(0, interval.end - Math.max(lastEnd, interval.start));
        lastEnd = Math.max(lastEnd, interval.end);
    }
    const details = frame.details;
    const isRoot = action.isRoot && frame === action.frame;
    const retryCount = isRoot ? action.root.retryCount : frame.retryCount;
    const recovered = isRoot ? action.root.recovered : frame.recovered;
    return {
        properties: {
            workflowSchemaVersion: '1', workflow: action.root.workflow, command: action.root.command,
            workflowRunId: action.root.id, attemptId: frame.id, parentAttemptId: frame.parentId,
            isWorkflowRoot: String(isRoot), stage: frame.stage ?? 'workflow', stepId: frame === action.frame ? action.stepId : frame.stepId,
            outcome: frame.outcome, cancelReason: details.cancelReason,
            failureCategory: details.failureCategory, failureCode: details.failureCode,
            retryable: details.retryable === undefined ? undefined : String(details.retryable),
            recoveredAfterRetry: recovered === undefined ? undefined : String(frame.outcome === 'succeeded' && recovered),
            deploymentMechanism: details.deploymentMechanism ?? action.frame.details.deploymentMechanism,
            deploymentStatus: details.deploymentStatus,
            httpStatus: details.httpStatus === undefined ? undefined : `${Math.floor(details.httpStatus / 100)}xx`,
            networkCategory: details.networkCategory,
            timingScope: 'observed', userWaitTiming: waitObserved ? 'available' : 'unavailable'
        },
        measurements: {
            duration: duration / 1000,
            workflowDuration: duration / 1000, activeDuration: Math.max(0, duration - userWait) / 1000,
            userWaitDuration: waitObserved ? userWait / 1000 : undefined, retryCount
        }
    };
}

function sendStage(context: types.IActionContext, action: Action, frame: Frame): void {
    if (context.telemetry.suppressAll || (context.telemetry.suppressIfSuccessful && frame.outcome === 'succeeded')) {
        return;
    }
    const payload = createPayload(action, frame);
    try {
        ext._internalReporter.sendTelemetryErrorEvent('workflowStage', payload.properties, payload.measurements);
    } catch {
        context.telemetry.properties.workflowTelemetryFailed = 'true';
    }
}
