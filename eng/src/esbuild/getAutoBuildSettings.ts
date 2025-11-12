/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Gets the auto-build settings from environment variables and command-line arguments.
 */
export function getAutoBuildSettings(): { isAutoDebug: boolean; isAutoWatch: boolean; } {
    const autoDebugEnvValue = (process.env.DEBUG_ESBUILD ?? '').toLowerCase();
    const isAutoDebug = ['1', 'true', 'yes', 'y', 'on'].includes(autoDebugEnvValue);
    const isAutoWatch = process.argv.includes('--watch');
    return { isAutoDebug, isAutoWatch, };
}
