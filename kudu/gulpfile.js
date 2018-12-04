/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require('gulp');
const autorest = require('autorest');
const path = require('path');
const fse = require('fs-extra');

gulp.task('build', async (callback) => {
    // use local version of autorest extensions instead of global machine versions
    await autorest.initialize("./node_modules/@microsoft.azure/autorest-core");

    const autorestInstance = await autorest.create();
    autorestInstance.AddConfiguration({
        "nodejs": {
            "package-name": "vscode-azurekudu",
            "license-header": "MICROSOFT_MIT_NO_VERSION",
            "add-credentials": "true",
        },
        "title": "KuduClient",
        "input-file": path.join(__dirname, 'swagger.json')
    });
    autorestInstance.Message.Subscribe((_, msg) => {
        if (msg.Channel !== 'file' && msg.Text) {
            console.log(msg.FormattedMessage || msg.Text);
        }
    });
    autorestInstance.GeneratedFile.Subscribe((_, file) => {
        if (file.uri.includes('lib')) {
            const uri = file.uri.slice(file.uri.indexOf('lib'));
            fse.ensureFileSync(uri);
            fse.writeFileSync(uri, file.content);
        }
    });

    const result = await autorestInstance.Process().finish; // boolean | Error
    let error = undefined;
    if (typeof result !== 'boolean') {
        error = result;
    } else if (result !== true) {
        error = new Error('Autorest failed for unknown reason.');
    }

    callback(error); // exit gulp
    process.exit(); // exit autorest
});