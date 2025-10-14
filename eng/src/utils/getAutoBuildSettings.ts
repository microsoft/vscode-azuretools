/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gets the auto-build settings
 * @param builder Whether the builder is webpack or esbuild
 * @returns The auto-build settings
 */
export function getAutoBuildSettings(builder: 'webpack' | 'esbuild'): { isAutoDebug: boolean; isAutoWatch: boolean; } {
    const autoDebugEnvValue =
        builder === 'webpack' ?
            process.env.DEBUG_WEBPACK :
            process.env.DEBUG_ESBUILD;
    const isAutoDebug = ['1', 'true', 'yes', 'y', 'on'].includes((autoDebugEnvValue ?? '').toLowerCase());
    const isAutoWatch = process.argv.includes('--watch');
    return { isAutoDebug, isAutoWatch, };
}
