/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { type MochaOptions } from 'mocha';
import { cloneConfig } from '../cloneConfig.ts';

export interface NodeMochaConfig extends MochaOptions {
    spec?: string | string[];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'node-option'?: string[];
}

/**
 * Creates a standalone Node/TypeScript Mocha CLI configuration.
 * Additional Node options are appended to the shared TypeScript loader and test globals.
 */
export function createNodeMochaConfig(overrides: NodeMochaConfig = {}): NodeMochaConfig {
    return cloneConfig({
        ui: 'bdd',
        spec: ['src/test/**/*.test.{ts,mts,cts}'],
        ...overrides,
        'node-option': [
            'experimental-transform-types',
            'import=@microsoft/vscode-azext-eng/mocha',
            ...(overrides['node-option'] ?? []),
        ],
    });
}
