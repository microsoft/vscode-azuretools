/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IPackageLintOptions } from '../..';

interface IMenu {
    command: string;
    when?: string;
    group?: string;
}

// tslint:disable:typedef
interface IPackage {
    name?: string;
    activationEvents?: string[];
    contributes?: {
        views?: {
            [viewContainerName: string]: {
                id: string;
                name: string;
                when?: string;
            }[];
        };
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
// tslint:enable:typedef

function emptyIfUndefined<T extends {}>(value: T | undefined): T {
    // tslint:disable-next-line:strict-boolean-expressions no-object-literal-type-assertion
    return value || <T>{};
}

/**
 * Sets up test suites against an extension package.json file (run this at global level or inside a suite, not inside a test)
 *
 * @param packageJson The extension's package.json contents as an object
 */
// tslint:disable:max-func-body-length
export function addPackageLintSuites(
    getExtensionContext: () => {},
    getCommands: () => Promise<string[]>,
    packageJsonAsObject: {},
    options: IPackageLintOptions
): void {
    const packageJson: IPackage = <IPackage>packageJsonAsObject;

    //tslint:disable-next-line:strict-boolean-expressions
    const commandsRegisteredButNotInPackage: string[] = options.commandsRegisteredButNotInPackage || [];

    let _registeredCommands: string[] | undefined;
    async function getRegisteredCommands(): Promise<string[]> {
        if (!_registeredCommands) {
            // We must wait to call these until the tests are actually run, because suite() runs too early for extension activation
            assert(!!<{} | undefined>getExtensionContext(), 'The extension must be activated before any tests are run, otherwise its commands won\'t have been registered yet');
            const registeredCommands: string[] = await getCommands();

            // Remove predefined IDs
            const predefinedCommandIds: string[] = getPredefinedCommandIdsForExtension();
            _registeredCommands = registeredCommands.filter((cmdId: string) => !predefinedCommandIds.some((c: string) => c === cmdId));
        }

        return _registeredCommands;
    }

    const activationEvents: string[] = emptyIfUndefined(packageJson.activationEvents);
    // tslint:disable-next-line:typedef
    const contributes = emptyIfUndefined(packageJson.contributes);
    // tslint:disable-next-line:typedef
    const views = emptyIfUndefined(contributes.views);
    // tslint:disable-next-line:typedef
    const commands = emptyIfUndefined(contributes.commands);

    // All commands should start with the same prefix - get prefix from first command
    const extensionPrefixWithPeriod: string = commands[0].command.substr(0, commands[0].command.indexOf('.') + 1);

    function verifyStartsWithExtensionPrefix(name: string): void {
        assert(name.startsWith(extensionPrefixWithPeriod), `Expected ${name} to start with ${extensionPrefixWithPeriod}`);
    }

    function getPredefinedCommandIdsForExtension(): string[] {
        const predefinedIds: string[] = [];

        for (const viewContainerName of Object.keys(views)) {
            // tslint:disable-next-line:typedef
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
            // tslint:disable-next-line:typedef
            const viewContainer = views[viewContainerName];
            for (const view of viewContainer) {
                const activationEvent: string = `onView:${view.id}`;
                test(view.id, () => {
                    assert(activationEvents.some((evt: string) => evt === activationEvent), `Couldn't find activation event ${activationEvent}`);
                });
            }
        }
    });

    suite('Activation events for commands in package.json', async () => {
        for (const cmd of commands) {
            const cmdId: string = cmd.command;
            const activationEvent: string = `onCommand:${cmdId}`;

            test(cmdId, async () => {
                verifyStartsWithExtensionPrefix(cmdId);

                const registeredCommands: string[] = await getRegisteredCommands();
                assert(registeredCommands.some((c: string) => c === cmdId), `${cmdId} is in package.json but wasn't registered with vscode`);
                assert(activationEvents.some((evt: string) => evt === activationEvent), `Couldn't find activation event for command ${cmdId}`);
            });
        }

        for (const event of activationEvents) {
            const onCommand: string = 'onCommand:';
            if (event.startsWith('onCommand')) {
                const cmdId: string = event.substr(onCommand.length);

                test(event, async () => {
                    const registeredCommands: string[] = await getRegisteredCommands();
                    assert(registeredCommands.some((c: string) => c === cmdId), `${event} is in package.json but ${cmdId} wasn't registered with vscode`);
                    // tslint:disable-next-line:typedef
                    assert(commands.some(cmd => cmd.command === cmdId), `${event} is in package.json but ${cmdId} wasn't a command in package.json`);
                });
            }
        }
    });

    test('Activation events for commands registered with vscode', async () => {
        const registeredCommands: string[] = await getRegisteredCommands();
        for (const cmd of registeredCommands) {
            const cmdId: string = cmd;
            const activationEvent: string = `onCommand:${cmdId}`;

            if (cmdId.startsWith(extensionPrefixWithPeriod)) {
                // tslint:disable-next-line:typedef
                const isInPackage: boolean = commands.some(c => c.command === cmdId);
                if (commandsRegisteredButNotInPackage.some((c: string) => c === cmdId)) {
                    assert(!isInPackage, `${cmdId} is in commandsRegisteredButNotInPackage but was found in package.json`);
                    assert(!activationEvents.some((evt: string) => evt === activationEvent), `${cmdId} is in commandsRegisteredButNotInPackage but has an activation event`);
                } else {
                    assert(isInPackage, `${cmdId} was registered as a command during extension activation but is not in package.json`);
                    assert(activationEvents.some((evt: string) => evt === activationEvent), `Couldn't find activation event for registered command ${cmdId}`);
                }
            }
        }
    });
}
