#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * This script sorts:
 * 
 * package.json
 *  - activationEvents
 *  - contributes.commands
 *  - contributes.menus
 * 
 * package.nls.json
 */

const path = require('path');
const fs = require('fs/promises');

async function sortPackageJson(path) {
    const packageJson = JSON.parse((await fs.readFile(path)).toString());

    packageJson.activationEvents = packageJson.activationEvents.sort();

    sortCommands(packageJson.contributes.commands);
    sortMenus(packageJson.contributes.menus);

    await writeJson(path, packageJson);
}

const sortCommand = (a, b) => a.command.localeCompare(b.command);

function sortCommands(commands) {
    commands = commands.sort(sortCommand);
}

function sortMenus(menus) {
    Object.keys(menus).forEach((key) => {
        menus[key] = menus[key].sort(sortCommand);
    });
}

async function sortPackageNls(path) {
    let packageNls = JSON.parse((await fs.readFile(path)).toString());
    packageNls = sortObject(packageNls);
    await writeJson(path, packageNls);
}

async function writeJson(path, object) {
    await fs.writeFile(path, JSON.stringify(object, null, 4));
}

function sortObject(object) {
    return Object.keys(object)
        .sort()
        .reduce(function (acc, key) {
            acc[key] = object[key];
            return acc;
        }, {});
}

sortPackageJson(path.resolve('package.json'));
sortPackageNls(path.resolve('package.nls.json'));
