/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// tslint:disable:typedef

/**
 * Sanity tests for the extension's package.json
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { IPackageLintOptions } from '../..';
import { ext } from '../extensionVariables';

interface IMenu {
    command: string;
    when?: string;
    group?: string;
}

interface IPackage {
    name: string;
    activationEvents?: string[];
    contributes?: {
        views?: {
            [viewContainerName: string]: {
                id: string;
                name: string;
                when?: string;
            }[]
        }
        commands?: {
            command: string;
        }[];
        menus?: {
            'view/title': IMenu[];
            'explorer/context': IMenu[];
            'view/item/context': IMenu[];
            commandPalette: {
                command: string;
                when?: string;
            }[];
        };
    };
}

function emptyIfUndefined<T extends {}>(value: T | undefined): T {
    //tslint:disable-next-line:strict-boolean-expressions
    return value || <T>{};
}

// tslint:disable-next-line:max-func-body-length
export function packageLint(packageJson: IPackage, options: IPackageLintOptions = {}): void {
    //tslint:disable-next-line:strict-boolean-expressions
    const commandsRegisteredButNotInPackage = options.commandsRegisteredButNotInPackage || [];

    let _registeredCommands: string[] | undefined;
    async function getRegisteredCommands(): Promise<string[]> {
        if (!_registeredCommands) {
            assert(!!<vscode.ExtensionContext | undefined>ext.context, 'The extension must be activated before running packageLint, otherwise its commands won\'t have been registered yet');
            const registeredCommands = await vscode.commands.getCommands();

            // Remove predefined IDs
            const predefinedCommandIds = getPredefinedCommandIdsForExtension();
            _registeredCommands = registeredCommands.filter(cmdId => !predefinedCommandIds.some(c => c === cmdId));
        }

        return _registeredCommands;
    }

    const activationEvents: string[] = emptyIfUndefined(packageJson.activationEvents);
    const contributes = emptyIfUndefined(packageJson.contributes);
    const views = emptyIfUndefined(contributes.views);
    const commands = emptyIfUndefined(contributes.commands);

    // All commands should start with the same prefix - get prefix from first command
    const extensionPrefixWithPeriod: string = commands[0].command.substr(0, commands[0].command.indexOf('.') + 1);

    function verifyStartsWithExtensionPrefix(name: string): void {
        assert(name.startsWith(extensionPrefixWithPeriod), `Expected ${name} to start with ${extensionPrefixWithPeriod}`);
    }

    function getPredefinedCommandIdsForExtension(): string[] {
        const predefinedIds: string[] = [];

        for (const viewContainerName of Object.keys(views)) {
            const viewContainer = views[viewContainerName];
            for (const view of viewContainer) {
                // vscode automatic creates focus commands for each view
                predefinedIds.push(`${view.id}.focus`);
            }
        }

        return predefinedIds;
    }

    suite('Activation events for views', async () => {
        for (const viewContainerName of Object.keys(views)) {
            const viewContainer = views[viewContainerName];
            for (const view of viewContainer) {
                const activationEvent = `onView:${view.id}`;
                test(view.id, () => {
                    assert(activationEvents.some(evt => evt === activationEvent), `Couldn't find activation event ${activationEvent}`);
                });
            }
        }
    });

    suite('Activation events for commands in package.json', async () => {
        for (const cmd of commands) {
            const cmdId = cmd.command;
            const activationEvent = `onCommand:${cmdId}`;

            test(cmdId, async () => {
                verifyStartsWithExtensionPrefix(cmdId);

                const registeredCommands = await getRegisteredCommands();
                assert(registeredCommands.some(c => c === cmdId), `${cmdId} is in package.json but wasn't registered with vscode`);
                assert(activationEvents.some(evt => evt === activationEvent), `Couldn't find activation event for command ${cmdId}`);
            });
        }

        for (const event of activationEvents) {
            const onCommand = 'onCommand:';
            if (event.startsWith('onCommand')) {
                const cmdId = event.substr(onCommand.length);

                test(event, async () => {
                    const registeredCommands = await getRegisteredCommands();
                    assert(registeredCommands.some(c => c === cmdId), `${event} is in package.json but ${cmdId} wasn't registered with vscode`);
                    assert(commands.some(cmd => cmd.command === cmdId), `${event} is in package.json but ${cmdId} wasn't a command in package.json`);
                });
            }
        }
    });

    test('Activation events for commands registered with vscode', async () => {
        const registeredCommands = await getRegisteredCommands();
        for (const cmd of registeredCommands) {
            const cmdId = cmd;
            const activationEvent = `onCommand:${cmdId}`;

            if (cmdId.startsWith(extensionPrefixWithPeriod)) {
                const isInPackage = commands.some(c => c.command === cmdId);
                if (commandsRegisteredButNotInPackage.some(c => c === cmdId)) {
                    assert(!isInPackage, `${cmdId} is in commandsRegisteredButNotInPackage but was found in package.json`);
                    assert(!activationEvents.some(evt => evt === activationEvent), `${cmdId} is in commandsRegisteredButNotInPackage but has an activation event`);
                } else {
                    assert(isInPackage, `${cmdId} was registered as a command during extension activation but is not in package.json`);
                    assert(activationEvents.some(evt => evt === activationEvent), `Couldn't find activation event for registered command ${cmdId}`);
                }
            }
        }
    });
}
