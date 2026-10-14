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
        "scripts": {
    +        "build": "node esbuild.mjs"
        }
    ```

1. (Recommended) esbuild does not do type-checking. Use this package's native TypeScript 7
   dependency for a separate type-checking script:
    ```diff
        "scripts": {
    +        "check": "node ./node_modules/@typescript/native/bin/tsc --noEmit"
        }
    ```
   Invoke the alias explicitly to avoid selecting TypeScript 6's `tsc`. For pnpm
   hoisting and watch commands, see [TypeScript compilers](../../MIGRATION.md#typescript-compilers).

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
configs.extension.plugins = [
    ...(configs.extension.plugins ?? []),
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
await autoEsbuildOrWatch({
    ...autoSelectEsbuildConfig(),
    webview: createWebviewEsbuildConfig({
        entryPoints: { views: './src/webview/webviewEntry.tsx' },
    }),
});
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
Filesystem import search directories are also watched, including nested and index-file
locations and configured `loadPaths`, so creating a missing stylesheet triggers recovery.
Custom importer-specific resolution inputs are not automatically watched.

## Ordered Bundles

`autoSelectEsbuildConfig()` returns `ExtensionEsbuildConfigs`: an object with a
required `extension` config and an optional `telemetry` config. The standard
`autoEsbuildOrWatch(autoSelectEsbuildConfig())` call is unchanged. Customize the
extension directly, for example `configs.extension.alias = { ... }`, and add other
configs by key, such as `configs.webview = createWebviewEsbuildConfig(...)`.

The runner accepts `EsbuildConfigs`, a map of names to plain esbuild configs; an
extension config is not required for custom sequences. Undefined entries are
omitted. Migrate the old `extensionConfig`/`telemetryConfig` properties to
`extension`/`telemetry`. There is no separate bundle descriptor or `watch` option.

The reserved `telemetry` config always builds first, only once, with metadata
disabled, even if inserted last or configured with `metafile: true`. All other
configs follow JavaScript property enumeration order and are watched when
`--watch` is set. Use descriptive keys rather than integer-like keys, which
JavaScript enumerates numerically instead of in insertion order. The runner awaits
each initial build, including in watch mode; subsequent rebuilds are independent.
SIGINT/SIGTERM and initialization failures dispose all watch contexts.

The runner owns the VS Code problem-matcher start/finish messages. One pair covers
the complete initial sequence; watch rebuilds emit a finish only when all active
bundles and their post-build plugins have completed. Standalone configs do not emit
these task-readiness markers.

Both extension and webview factories use unminified builds with linked source maps
when `--watch` is set, even with `DEBUG_ESBUILD` enabled. Debug independently adds
extension and webview metadata; telemetry keeps its production settings.

Each object's key names its bundle in build-failure messages and metadata filenames.
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
