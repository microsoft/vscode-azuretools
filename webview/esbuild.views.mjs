/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isAutoDebug, isAutoWatch } from '@microsoft/vscode-azext-eng/esbuild';
import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outdir = path.resolve(__dirname, 'dist');

const commonConfig = {
    entryPoints: {
        views: path.resolve(__dirname, 'src/webviewEntry.tsx'),
    },

    bundle: true,
    outdir: outdir,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    sourcemap: isAutoWatch,
    minify: !isAutoWatch,
    metafile: isAutoDebug,
    splitting: false,

    inject: [path.resolve(__dirname, 'react-shim.js')],

    loader: {
        '.ts': 'ts',
        '.tsx': 'tsx',
        '.css': 'css',
        '.scss': 'css',
        '.ttf': 'dataurl',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
    },

    plugins: [
        {
            name: 'sass',
            setup(build) {
                build.onLoad({ filter: /\.s[ac]ss$/ }, async (args) => {
                    const sass = await import('sass');
                    const result = sass.compile(args.path);
                    return {
                        contents: result.css,
                        loader: 'css',
                    };
                });
            },
        },
    ],
    logLevel: 'info'
};

const ctx = await esbuild.context({
    ...commonConfig,
    outdir,
});

// Always do an initial rebuild to ensure views.js exists
await ctx.rebuild();

if (isAutoWatch) {
    await ctx.watch();
    console.log('Watching webview bundle...');
    await new Promise(() => { });
} else {
    await ctx.rebuild();
    await ctx.dispose();
}
