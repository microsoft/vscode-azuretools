/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESLint } from 'eslint';
import { build, context, type Plugin } from 'esbuild';
import { createNodeMochaConfig } from '../mocha/config.js';
import { azExtTestConfig, azExtSrcTestConfig, baseConfig, createVscodeTestConfig } from '../vscode-test/vscodeTestConfigs.js';
import { linkVscodeTestCache } from '../vscode-test/linkTestCache.js';
import {
    azExtEslintRecommended, azExtEslintRecommendedTypeChecked, azExtEslintStrict, azExtEslintStrictTypeChecked,
    explicitTsProjectRuleConfig, importRestrictionsRuleConfig, lazyImportRuleConfig,
} from '../eslint/eslintConfigs.js';
import { createWebviewEsbuildConfig } from '../esbuild/esbuildConfigs.js';
import { sassPlugin } from '../esbuild/sassPlugin.js';

const exec = promisify(execFile);
const packageDir = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);

await test('builds use native TypeScript 7 while ESLint resolves the TypeScript 6 API', async () => {
    const parserRequire = createRequire(require.resolve('@typescript-eslint/parser'));
    const compiler: typeof import('typescript') = parserRequire('typescript');
    assert.match(compiler.version, /^6\.0\./);
    assert.equal(typeof compiler.createProgram, 'function');
    const { stdout } = await exec(process.execPath, [
        path.join(packageDir, 'node_modules', '@typescript', 'native', 'bin', 'tsc'),
        '--version',
    ]);
    assert.match(stdout, /Version 7\./);
});

async function fixture(t: TestContext) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'azext-tooling-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    async function write(relative: string, contents: string) {
        const file = path.join(root, relative);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, contents);
    }
    return { root, write };
}

await test('test-cache linker creates, reuses, and repairs a dangling link', async t => {
    const { root } = await fixture(t);
    const extensionDir = path.join(root, 'extension');
    const cacheDir = path.join(root, 'cache');
    await fs.mkdir(extensionDir);
    assert.equal((await linkVscodeTestCache({ extensionDir, cacheDir })).action, 'created');
    assert.equal((await linkVscodeTestCache({ extensionDir, cacheDir })).action, 'unchanged');
    await fs.rmdir(cacheDir);
    assert.equal((await linkVscodeTestCache({ extensionDir, cacheDir })).action, 'unchanged');
    assert.ok((await fs.stat(cacheDir)).isDirectory());
    assert.equal(await fs.realpath(path.join(extensionDir, '.vscode-test')), await fs.realpath(cacheDir));
});

await test('test-cache linker refuses real directories and preserves their contents', async t => {
    const { root, write } = await fixture(t);
    await write('extension/.vscode-test/important.txt', 'keep');
    const options = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'cache'), replaceExistingLink: true };
    await assert.rejects(linkVscodeTestCache(options), /Refusing to replace/);
    assert.equal(await fs.readFile(path.join(root, 'extension/.vscode-test/important.txt'), 'utf8'), 'keep');
    await assert.rejects(fs.stat(options.cacheDir), { code: 'ENOENT' });
});

await test('test-cache replacement requires opt-in and never removes cache contents', async t => {
    const { root, write } = await fixture(t);
    await fs.mkdir(path.join(root, 'extension'));
    const first = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'first') };
    await linkVscodeTestCache(first);
    await write('first/keep.txt', 'keep');
    const second = { ...first, cacheDir: path.join(root, 'second') };
    await assert.rejects(linkVscodeTestCache(second), /--replace/);
    assert.equal(await fs.realpath(path.join(first.extensionDir, '.vscode-test')), await fs.realpath(first.cacheDir));
    assert.equal((await linkVscodeTestCache({ ...second, replaceExistingLink: true })).action, 'replaced');
    assert.equal(await fs.readFile(path.join(root, 'first/keep.txt'), 'utf8'), 'keep');
    assert.equal(await fs.realpath(path.join(first.extensionDir, '.vscode-test')), await fs.realpath(second.cacheDir));
    assert.deepEqual(await fs.readdir(first.extensionDir), ['.vscode-test']);
});

await test('test-cache linker rejects overlapping and invalid directories', async t => {
    const { root, write } = await fixture(t);
    await fs.mkdir(path.join(root, 'extension'));
    const extensionDir = path.join(root, 'extension');
    for (const cacheDir of [extensionDir, path.join(extensionDir, '.vscode-test'), path.join(extensionDir, '.vscode-test/child')]) {
        await assert.rejects(linkVscodeTestCache({ extensionDir, cacheDir }), /must not contain/);
    }
    await assert.rejects(linkVscodeTestCache({ extensionDir, cacheDir: '' }), /must not be empty/);
    await write('not-a-directory', 'file');
    await assert.rejects(linkVscodeTestCache({ extensionDir, cacheDir: path.join(root, 'not-a-directory') }));
    await assert.rejects(linkVscodeTestCache({ extensionDir: path.join(root, 'missing'), cacheDir: path.join(root, 'cache') }), { code: 'ENOENT' });
});

await test('test-cache replacement restores the old link when rename fails', async t => {
    const { root } = await fixture(t);
    await fs.mkdir(path.join(root, 'extension'));
    const script = `
        const assert = require('node:assert/strict');
        const fs = require('node:fs/promises');
        const path = require('node:path');
        const { linkVscodeTestCache } = require('@microsoft/vscode-azext-eng/vscode-test/cache');
        async function run() {
            const root = ${JSON.stringify(root)};
            const options = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'first') };
            await linkVscodeTestCache(options);
            fs.rename = async () => { throw new Error('rename blocked'); };
            await assert.rejects(
                linkVscodeTestCache({ ...options, cacheDir: path.join(root, 'second'), replaceExistingLink: true }),
                /rename blocked/
            );
            assert.equal(await fs.realpath(path.join(options.extensionDir, '.vscode-test')), await fs.realpath(options.cacheDir));
            assert.deepEqual(await fs.readdir(options.extensionDir), ['.vscode-test']);
        }
        run().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    await exec(process.execPath, ['-e', script], { cwd: packageDir });
});

await test('test-cache linker resolves relative symlink targets against the link parent', { skip: process.platform === 'win32' }, async t => {
    const { root } = await fixture(t);
    await fs.mkdir(path.join(root, 'extension'));
    await fs.mkdir(path.join(root, 'cache'));
    await fs.symlink('../cache', path.join(root, 'extension/.vscode-test'), 'dir');
    assert.equal((await linkVscodeTestCache({ extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'cache') })).action, 'unchanged');
});

await test('cache CLI honors the environment and reports refusal with a failure exit', async t => {
    const { root, write } = await fixture(t);
    await fs.mkdir(path.join(root, 'extension'));
    const cli = path.join(packageDir, 'dist/cjs/vscode-test/linkTestCacheCli.js');
    const env = { ...process.env };
    env.VSCODE_TEST_CACHE_DIR = 'cache';
    const options = { cwd: root, env };
    const result = await exec(process.execPath, [cli, '--extension-dir', 'extension'], options);
    assert.match(result.stdout, /Test cache created/);
    assert.equal(await fs.realpath(path.join(root, 'extension/.vscode-test')), await fs.realpath(path.join(root, 'cache')));
    await write('other/.vscode-test/keep.txt', 'keep');
    await assert.rejects(exec(process.execPath, [cli, '--extension-dir', 'other'], options), /Refusing to replace/);
});

await test('VS Code factories merge nested defaults and isolate mutable configuration', () => {
    const extra = {
        mocha: { ui: 'bdd', require: ['extra-hook'], reporterOptions: { nested: { enabled: true } } },
        env: { EXTRA: '1' },
        launchArgs: ['--disable-gpu'],
    } satisfies NonNullable<Parameters<typeof createVscodeTestConfig>[0]>;
    const first = createVscodeTestConfig(extra);
    const second = createVscodeTestConfig();
    assert.ok(first.mocha);
    assert.ok(first.env);
    assert.equal(first.mocha.ui, 'bdd');
    assert.equal(first.mocha.timeout, 10000);
    assert.deepEqual(first.mocha.require, [...(baseConfig.mocha?.require ?? []), 'extra-hook']);
    assert.equal(first.env.VSCODE_RUNNING_TESTS, '1');
    assert.equal(first.env.EXTRA, '1');
    first.mocha.require.push('mutation');
    first.launchArgs?.push('mutation');
    assert.deepEqual(extra.mocha.require, ['extra-hook']);
    assert.ok(!second.mocha?.require?.includes('mutation'));
    assert.ok(!second.launchArgs?.includes('mutation'));
    assert.notEqual(first.mocha.reporterOptions, extra.mocha.reporterOptions);
    const reporterOptions = first.mocha.reporterOptions as typeof extra.mocha.reporterOptions;
    reporterOptions.nested.enabled = false;
    assert.equal(extra.mocha.reporterOptions.nested.enabled, true);
    assert.notEqual(azExtTestConfig.mocha, azExtSrcTestConfig.mocha);
    assert.equal(azExtSrcTestConfig.workspaceFolder, 'src/test/test.code-workspace');
});

await test('Node Mocha factory is isolated and runs ts/mts/cts with shared globals and extensionless imports', async t => {
    const { root, write } = await fixture(t);
    await fs.mkdir(path.join(root, 'node_modules/@microsoft'), { recursive: true });
    await fs.symlink(packageDir, path.join(root, 'node_modules/@microsoft/vscode-azext-eng'), 'junction');
    const configModule = path.join(packageDir, 'dist/cjs/mocha/config.js');
    await write('.mocharc.cjs', `module.exports = require(${JSON.stringify(configModule)}).createNodeMochaConfig();`);
    await write('src/test/helper.ts', 'export const value = 1;');
    await write('src/test/example.test.ts', "import { value } from './helper'; enum Value { One = 1 } describe('ts', () => it('loads', () => expect(value).to.equal(Value.One)));");
    await write('src/test/example.test.mts', "describe('mts', () => it('loads', () => expect(true).to.equal(true)));");
    await write('src/test/example.test.cts', "describe('cts', () => it('loads', () => expect(true).to.equal(true)));");
    const result = await exec(process.execPath, [require.resolve('mocha/bin/mocha.js')], { cwd: root });
    assert.match(result.stdout, /3 passing/);
    const options = { 'node-option': ['trace-warnings'], spec: ['test/**/*.ts'] };
    const config = createNodeMochaConfig(options);
    config['node-option']?.push('mutation');
    assert.deepEqual(options['node-option'], ['trace-warnings']);
    assert.ok(!createNodeMochaConfig()['node-option']?.includes('mutation'));
});

await test('all ESLint presets ignore underscore-prefixed bindings but report other unused locals', async t => {
    const { root, write } = await fixture(t);
    await write('tsconfig.json', '{"compilerOptions":{"strict":true},"include":["*.ts"]}');
    await write('sample.ts', 'const _unused = 1; const unused = 2; try { throw new Error(); } catch (_error) {}');
    for (const preset of [azExtEslintRecommended, azExtEslintRecommendedTypeChecked, azExtEslintStrict, azExtEslintStrictTypeChecked]) {
        const eslint = new ESLint({
            cwd: root,
            overrideConfigFile: true,
            overrideConfig: [...preset, explicitTsProjectRuleConfig('./tsconfig.json', root)],
        });
        const [result] = await eslint.lintFiles(['sample.ts']);
        assert.ok(!result.messages.some(message => message.fatal), JSON.stringify(result.messages));
        const unused = result.messages.filter(message => message.ruleId === '@typescript-eslint/no-unused-vars');
        assert.equal(unused.length, 1, JSON.stringify(result.messages));
        assert.match(unused[0].message, /'unused'/);
        assert.ok(!result.messages.some(message => message.ruleId === 'no-unused-vars'));
        assert.ok(!result.messages.some(message => message.ruleId === '@typescript-eslint/naming-convention'));
    }
});

await test('combined import restrictions preserve both boundaries and lazy patterns', async t => {
    const { root, write } = await fixture(t);
    await write('tsconfig.json', '{"include":["*.ts"]}');
    await write('sample.ts', [
        "import type { Uri } from 'vscode';",
        "import { workspace } from 'vscode';",
        "import type { Client } from '@azure/example';",
        "import { createClient } from '@azure/example';",
        'void workspace; void createClient;',
    ].join('\n'));
    const eslint = new ESLint({
        cwd: root,
        overrideConfigFile: true,
        overrideConfig: [
            ...azExtEslintRecommendedTypeChecked,
            explicitTsProjectRuleConfig('./tsconfig.json', root),
            importRestrictionsRuleConfig({ typeOnlyModules: ['vscode'], lazyPatterns: ['@azure/*'] }),
        ],
    });
    const [result] = await eslint.lintFiles(['sample.ts']);
    const restricted = result.messages.filter(message => message.ruleId === '@typescript-eslint/no-restricted-imports');
    assert.deepEqual(restricted.map(message => message.line), [2, 4]);
    assert.ok(lazyImportRuleConfig(['@azure/*']).rules?.['@typescript-eslint/no-restricted-imports']);
});

await test('browser factory excludes host configuration and composes caller options', async t => {
    const { root, write } = await fixture(t);
    await write('entry.ts', 'export const value = 1;');
    let pluginRan = false;
    const plugin: Plugin = {
        name: 'extra',
        setup(build) { build.onStart(() => { pluginRan = true; }); },
    };
    const config = createWebviewEsbuildConfig({
        absWorkingDir: root,
        entryPoints: ['entry.ts'],
        loader: { '.svg': 'file' },
        plugins: [plugin],
    });
    assert.equal(config.platform, 'browser');
    assert.equal(config.format, 'esm');
    assert.equal(config.external, undefined);
    assert.equal(config.alias, undefined);
    assert.equal(config.banner, undefined);
    assert.equal(config.loader?.['.css'], 'css');
    assert.equal(config.loader['.svg'], 'file');
    assert.equal(config.plugins?.[1], plugin);
    await build(config);
    assert.ok(pluginRan);
    assert.ok((await fs.stat(path.join(root, 'dist/entry.js'))).isFile());
    config.plugins.push(plugin);
    assert.equal(createWebviewEsbuildConfig().plugins?.length, 1);
});

await test('browser factory selects production, watch, and debug settings from shared flags', async () => {
    const script = `
        const { createWebviewEsbuildConfig } = require('@microsoft/vscode-azext-eng/esbuild');
        const config = createWebviewEsbuildConfig();
        console.log(JSON.stringify({ minify: config.minify, sourcemap: config.sourcemap, metafile: config.metafile }));
    `;
    for (const [args, debug, expected] of [
        [[], '0', { minify: true, sourcemap: false }],
        [['--watch'], '0', { minify: false, sourcemap: 'linked' }],
        [['--watch'], '1', { minify: true, sourcemap: false, metafile: true }],
    ] as const) {
        const env = { ...process.env };
        env.DEBUG_ESBUILD = debug;
        const result = await exec(process.execPath, ['-e', script, '--', ...args], { cwd: packageDir, env });
        assert.deepEqual(JSON.parse(result.stdout), expected);
    }
});

await test('Sass plugin resolves CSS assets and watches imported stylesheets', async t => {
    const { root, write } = await fixture(t);
    await write('styles/_variables.scss', '$color: red;');
    await write('styles/main.scss', '@use "variables"; .root { color: variables.$color; background: url("./image.svg"); }');
    await write('styles/image.svg', '<svg/>');
    let finished: (() => void) | undefined;
    function nextBuild(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => { reject(new Error('Sass watch rebuild timed out')); }, 10000);
            finished = () => { clearTimeout(timeout); resolve(); };
        });
    }
    const ctx = await context(createWebviewEsbuildConfig({
        absWorkingDir: root,
        entryPoints: ['styles/main.scss'],
        minify: false,
        loader: { '.svg': 'file' },
        plugins: [sassPlugin(), {
            name: 'watch-test',
            setup(build) { build.onEnd(() => { finished?.(); }); },
        }],
    }));
    try {
        const initial = nextBuild();
        await ctx.watch();
        await initial;
        assert.match(await fs.readFile(path.join(root, 'dist/main.css'), 'utf8'), /color: red/);
        const updated = nextBuild();
        await write('styles/_variables.scss', '$color: blue;');
        await updated;
        const css = await fs.readFile(path.join(root, 'dist/main.css'), 'utf8');
        assert.match(css, /color: blue/);
        assert.match(css, /image-.*\.svg/);
    } finally {
        await ctx.dispose();
    }
});

await test('Sass compilation errors fail the build', async t => {
    const { root, write } = await fixture(t);
    await write('broken.scss', '.root { color: $undefined; }');
    await assert.rejects(build(createWebviewEsbuildConfig({
        absWorkingDir: root,
        entryPoints: ['broken.scss'],
        plugins: [sassPlugin()],
        logLevel: 'silent',
    })), /Undefined variable/);
});

await test('public helpers load through CommonJS package exports without eagerly loading Sass', async () => {
    const script = `
        const Module = require('node:module');
        const original = Module._load;
        Module._load = function (id, ...args) {
            if (id === 'sass') throw new Error('Sass must not load eagerly');
            return original.call(this, id, ...args);
        };
        for (const [subpath, names] of [
            ['esbuild', ['copyPlugin', 'createWebviewEsbuildConfig']],
            ['esbuild/sass', ['sassPlugin']],
            ['eslint', ['explicitTsProjectRuleConfig', 'importRestrictionsRuleConfig']],
            ['vscode-test', ['createVscodeTestConfig']],
            ['vscode-test/cache', ['linkVscodeTestCache']],
            ['mocha/config', ['createNodeMochaConfig']]
        ]) {
            const api = require('@microsoft/vscode-azext-eng/' + subpath);
            for (const name of names) if (typeof api[name] !== 'function') throw new Error(name);
        }
    `;
    await exec(process.execPath, ['-e', script], { cwd: packageDir });
});

await test('public helpers load through ESM package exports', async () => {
    const script = `
        for (const [subpath, names] of [
            ['esbuild', ['copyPlugin', 'createWebviewEsbuildConfig']],
            ['esbuild/sass', ['sassPlugin']],
            ['eslint', ['explicitTsProjectRuleConfig', 'importRestrictionsRuleConfig']],
            ['vscode-test', ['createVscodeTestConfig']],
            ['vscode-test/cache', ['linkVscodeTestCache']],
            ['mocha/config', ['createNodeMochaConfig']]
        ]) {
            const api = await import('@microsoft/vscode-azext-eng/' + subpath);
            for (const name of names) if (typeof api[name] !== 'function') throw new Error(name);
        }
    `;
    await exec(process.execPath, ['--input-type=module', '-e', script], { cwd: packageDir });
});

await test('ordinary esbuild consumers type-check without the optional Sass peer', async t => {
    const { root, write } = await fixture(t);
    const installed = path.join(root, 'node_modules/@microsoft/vscode-azext-eng');
    await fs.mkdir(installed, { recursive: true });
    await fs.copyFile(path.join(packageDir, 'package.json'), path.join(installed, 'package.json'));
    await fs.cp(path.join(packageDir, 'dist'), path.join(installed, 'dist'), { recursive: true });
    await fs.symlink(path.join(packageDir, 'node_modules/esbuild'), path.join(root, 'node_modules/esbuild'), 'junction');
    const code = [
        "import { copyPlugin, createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';",
        "createWebviewEsbuildConfig({ plugins: [copyPlugin({ assets: [{ from: 'assets', to: 'assets' }] })] });",
    ].join('\n');
    await write('index.mts', code);
    await write('index.cts', code);
    await exec(process.execPath, [
        path.join(packageDir, 'node_modules', '@typescript', 'native', 'bin', 'tsc'),
        '--noEmit', '--module', 'nodenext', '--target', 'es2022', 'index.mts', 'index.cts',
    ], { cwd: root });
});
