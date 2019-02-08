/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'filemanager-webpack-plugin' {
    import { Plugin } from 'webpack';

    export = FilemanagerWebpackPlugin;

    class FilemanagerWebpackPlugin extends Plugin {
        constructor(options: FilemanagerWebpackPlugin.Options);

    }

    namespace FilemanagerWebpackPlugin {
        interface FileEvents {
            copy?: {
                source: string;
                destination: string;
            }[];
        }
        interface Options {
            /**
             * Commands to execute before Webpack begins the bundling process
             */
            onStart?: FileEvents;

            /**
             * Commands to execute after Webpack has finished the bundling process
             */
            onEnd?: FileEvents;
        }
    }
}
