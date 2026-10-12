# ESBuild Config for Azure Visual Studio Code Extensions

Contains default esbuild configuration for Azure extensions.

Requires Node.js 24 or later. Asset copying uses the native filesystem glob API.

# Minimal Usage

1. Add the esbuild dev dependencies. They are optional peer dependencies of this package, which
   will control the version. As such, use `*` as the desired version.
    ```diff
        "devDependencies": {
    +        "esbuild": "*"
        }
    ```

1. Add `esbuild.mjs` to the root of your extension package:
    ```js
    import { autoEsbuildOrWatch, autoSelectEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
    await autoEsbuildOrWatch(autoSelectEsbuildConfig());
    ```

1. Add the script to `package.json`:
    ```diff
        "scripts": [
    +        "build": "node esbuild.mjs"
        ]
    ```

1. (Recommended) esbuild does not do type-checking. Add a type-checking script to `package.json`:
    ```diff
        "scripts": [
    +        "check": "tsc --noEmit"
        ]
    ```

# Normal Usage

Check out [Container Tools](https://github.com/microsoft/vscode-containers) for a more advanced example,
including watch mode, custom entry points, and other options. The important files to check out are
`esbuild.mjs`, `package.json` scripts, `.vscode/tasks.json` and `.vscode/launch.json` configurations,
and extensions with problem matchers in `.vscode/extensions.json`.

# Copying Assets

The exported `copyPlugin` uses Node.js filesystem APIs without additional dependencies.
Append it to the inherited plugins to copy additional assets:

```js
import { autoEsbuildOrWatch, autoSelectEsbuildConfig, copyPlugin } from '@microsoft/vscode-azext-eng/esbuild';

const configs = autoSelectEsbuildConfig();
configs.extensionConfig.plugins = [
    ...(configs.extensionConfig.plugins ?? []),
    copyPlugin({
        assets: [
            {
                from: '../../packages/azutils/resources/azureIcons',
                to: './azureIcons',
                include: '**/*.svg',
            },
        ],
    }),
];
await autoEsbuildOrWatch(configs);
```

Each asset has a source directory (`from`), a destination directory (`to`), and optional
glob patterns (`include`, a string or array of strings, defaulting to `**/*`).
Source directories resolve against esbuild's `absWorkingDir`, or the current working directory.
Relative destinations resolve against `outdir`, or the directory containing `outfile`.
Absolute source and destination directories are also supported. Relative destinations require
`outdir` or `outfile`.

Only matching files are copied, preserving their paths relative to the source directory.
Existing files are overwritten. A mapping with no matching files produces an esbuild warning;
filesystem failures fail the build. Patterns must not match files outside the source directory.
Copying runs after every build, including rebuilds, but does not independently watch assets
or delete stale destination files.

## Migrating from esbuild-plugin-copy

Replace the import with `copyPlugin` from this package and remove `esbuild-plugin-copy`
from your dependencies. Unlike the old plugin, `from` is a directory, not a glob:

| Previous `from` | New `from` | New `include` |
| --- | --- | --- |
| `./node_modules/@microsoft/vscode-azext-azureutils/resources/azureIcons/*.svg` | `./node_modules/@microsoft/vscode-azext-azureutils/resources/azureIcons` | `*.svg` |
| `../../packages/azutils/resources/azureIcons/**/*.svg` | `../../packages/azutils/resources/azureIcons` | `**/*.svg` |
| `./node_modules/@azure-tools/azcopy-linux/**/*` | `./node_modules/@azure-tools/azcopy-linux` | `**/*` (the default) |

Keep existing `to` directories unchanged when migrating output-relative copies. The native
plugin always uses output-relative destinations; remove `resolveFrom: 'out'` if present.
For a former `resolveFrom: 'cwd'` mapping, pass an absolute destination instead.
Other old-plugin options are not supported.

# Webview Builds

Browser bundles have separate production, development, and debug presets:
`azExtWebviewEsbuildConfigProd`, `azExtWebviewEsbuildConfigDev`, and
`azExtWebviewEsbuildConfigDebug`. They do not inherit Node externals, the telemetry
alias, the require banner, or extension assets.

`createWebviewEsbuildConfig` selects the appropriate preset using the same
`DEBUG_ESBUILD` and `--watch` settings as extension builds. It merges loader overrides
and appends supplied plugins to the shared build logger. Entry points, React/JSX
configuration, and output naming remain the consumer's responsibility.

```js
import {
    autoEsbuildOrWatch,
    createWebviewEsbuildConfig,
} from '@microsoft/vscode-azext-eng/esbuild';
import { sassPlugin } from '@microsoft/vscode-azext-eng/esbuild/sass';

await autoEsbuildOrWatch({
    extensionConfig: createWebviewEsbuildConfig({
        entryPoints: { views: './src/webview/webviewEntry.tsx' },
        outdir: './dist/webview',
        plugins: [sassPlugin()],
    }),
});
```

The presets use bundled browser ESM, ES2022, no splitting, CSS loading, and data-URL
font loaders. Override these as needed. The existing runner handles one build or
watch mode, including problem-matcher logging and debug metafile output.

`sassPlugin` is optional: install the `sass` peer dependency (`"sass": "*"`) only when
using it. Its separate `esbuild/sass` entry point keeps optional Sass types out of
ordinary esbuild consumers; importing it does not load the compiler until needed. The plugin accepts
Sass asynchronous compiler options, reports imported files as watch dependencies,
resolves relative CSS assets from the source stylesheet, and surfaces compiler errors.

The default extension config now copies both Azureutils' top-level resource SVGs
and `resources/azureIcons/*.svg`. Consumers no longer need a separate copy mapping
for that nested directory.

---

[Back to Root](../../README.md)
