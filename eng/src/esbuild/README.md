# ESBuild Config for Azure Visual Studio Code Extensions

Contains default esbuild configuration for Azure extensions.

Requires Node.js 22.17.0 or later. Asset copying uses the native filesystem glob API.

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

const bundles = autoSelectEsbuildConfig();
const extensionConfig = bundles[1].config;
extensionConfig.plugins = [
    ...(extensionConfig.plugins ?? []),
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
await autoEsbuildOrWatch(bundles);
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
Destinations nested inside their source directory are excluded from source matches,
preventing previous output from being copied again on rebuilds.

## Destination Permissions

Source file permissions are preserved by default on POSIX. An asset's optional `mode`
sets exact destination permissions when it is a number, or transforms the current
permission bits when it is a synchronous callback:

| `mode` | Behavior |
| --- | --- |
| `0o755` | Set exact permissions |
| `current => current \| 0o100` | Add owner-execute, preserving other permissions |

Modes must be integers from `0` through `0o7777`; the callback receives only permission
bits, not file-type bits. Overrides run after copying each matched file on every build.
Callback errors, invalid modes, and chmod failures fail the build. Source files are not
chmodded; source/destination aliases are rejected when an override is requested.
Windows ignores overrides without logging and does not invoke callbacks.

To copy a whole native package but add owner-execute only to its executable, use a
filtered mapping after the package mapping:

```js
copyPlugin({
    assets: [
        {
            from: './node_modules/@azure-tools/azcopy-linux',
            to: './node_modules/@azure-tools/azcopy-linux',
        },
        {
            from: './node_modules/@azure-tools/azcopy-linux',
            to: './node_modules/@azure-tools/azcopy-linux',
            include: 'dist/bin/azcopy_linux_amd64',
            mode: current => current | 0o100,
        },
    ],
});
```

This replaces destination permission adjustments, not any separate changes to the
original binaries in `node_modules`.

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
and appends supplied plugins to the default Sass plugin. Entry points, React/JSX
configuration, and output naming remain the consumer's responsibility.
Watch mode is unminified with linked source maps, including when debug is enabled;
debug adds metadata independently.

```js
import {
    autoEsbuildOrWatch,
    autoSelectEsbuildConfig,
    createWebviewEsbuildConfig,
} from '@microsoft/vscode-azext-eng/esbuild';
await autoEsbuildOrWatch([
    ...autoSelectEsbuildConfig(),
    { name: 'webview', config: createWebviewEsbuildConfig({
        entryPoints: { views: './src/webview/webviewEntry.tsx' },
    }) },
]);
```

The presets use bundled browser ESM, ES2022, no splitting, CSS loading, and data-URL
font loaders and `./dist` output. Override these as needed.

The default Sass plugin loads the compiler only when a `.scss` or `.sass` file is
encountered. Install the optional `sass` peer dependency (`"sass": "*"`) when using
those files; missing Sass produces an installation error. Builds without Sass files
do not require the peer. To customize compiler options, set `sass: false` and append
`sassPlugin(options)` from the separate `esbuild/sass` entry. Its separate entry keeps
optional Sass types out of ordinary esbuild consumers. The plugin accepts
Sass asynchronous compiler options, reports imported files as watch dependencies,
resolves relative CSS assets from the source stylesheet, and surfaces compiler errors.
Imported files remain watched after compilation errors, so correcting them triggers a rebuild.

## Ordered Bundles

`autoSelectEsbuildConfig()` returns an ordered array of `{ name, config, watch? }`
bundles: `telemetry` first (`watch: false`, `metafile: false`), then `extension`. The standard
`autoEsbuildOrWatch(autoSelectEsbuildConfig())` call is unchanged. Custom consumers
must migrate from the old `extensionConfig`/`telemetryConfig` object to this array.
Append any additional bundles in the order they must initially build. The runner
awaits each initial build, including in watch mode; subsequent rebuilds are independent.
Telemetry still builds only once. SIGINT/SIGTERM and initialization failures dispose
all watch contexts.

The runner owns the VS Code problem-matcher start/finish messages. One pair covers
the complete initial sequence; watch rebuilds emit a finish only when all active
bundles and their post-build plugins have completed. Standalone configs do not emit
these task-readiness markers.

Both extension and webview factories use unminified builds with linked source maps
when `--watch` is set, even with `DEBUG_ESBUILD` enabled. Debug independently adds
extension and webview metadata; telemetry keeps its production settings.

Each bundle requires a unique name, used in build-failure messages and metadata filenames.
Names use letters, numbers, underscores, hyphens, and dots, starting with a letter,
number, underscore, or hyphen. Names must be unique ignoring case for portability.
Metafiles are written after builds and rebuilds to `esbuild.<name>.meta.json`
under `absWorkingDir` or cwd, such as `esbuild.extension.meta.json` and
`esbuild.webview.meta.json`. Telemetry metadata is disabled.

The default extension config now copies both Azureutils' top-level resource SVGs
and `resources/azureIcons/*.svg`. Consumers no longer need a separate copy mapping
for that nested directory.

---

[Back to Root](../../README.md)
