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

import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';

async function sortPackageJson(path) {
    if (!fs.existsSync(path)) {
        return;
    }

    const packageJson = JSON.parse((await fsPromises.readFile(path)).toString());

    packageJson.activationEvents = packageJson.activationEvents.sort();

    sortCommands(packageJson.contributes.commands);
    sortMenus(packageJson.contributes.menus);

    await writeJson(path, packageJson);
}

const sortCommand = (a, b) => a.command?.localeCompare(b.command);

function sortCommands(commands) {
    commands = commands.sort(sortCommand);
}

function sortMenus(menus) {
    const excludedKeys = ['view/item/context'];
    Object.keys(menus).forEach((key) => {
        if (!excludedKeys.includes(key)) {
            menus[key] = menus[key].sort(sortCommand);
        }
    });
}

async function sortPackageNls(path) {
    if (!fs.existsSync(path)) {
        return;
    }
    let packageNls = JSON.parse((await fsPromises.readFile(path)).toString());
    packageNls = sortObject(packageNls);
    await writeJson(path, packageNls);
}

async function writeJson(path, object) {
    await fsPromises.writeFile(path, `${JSON.stringify(object, null, 4)}\n`);
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
