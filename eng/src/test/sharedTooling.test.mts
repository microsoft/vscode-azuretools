/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, it } from 'mocha';
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
import { should } from './global.test.mjs';

const exec = promisify(execFile);
const packageDir = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(import.meta.url);
const fixtures: string[] = [];

afterEach(async () => {
    for (const root of fixtures.splice(0)) {
        await fs.rm(root, { recursive: true, force: true });
    }
});

it('builds use native TypeScript 7 while ESLint resolves the TypeScript 6 API', async () => {
    const parserRequire = createRequire(require.resolve('@typescript-eslint/parser'));
    const compiler: typeof import('typescript') = parserRequire('typescript');
    compiler.version.should.match(/^6\.0\./);
    compiler.createProgram.should.be.a('function');
    const { stdout } = await exec(process.execPath, [
        path.join(packageDir, 'node_modules', '@typescript', 'native', 'bin', 'tsc'),
        '--version',
    ]);
    stdout.should.match(/Version 7\./);
});

async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'azext-tooling-'));
    fixtures.push(root);
    async function write(relative: string, contents: string) {
        const file = path.join(root, relative);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, contents);
    }
    return { root, write };
}

it('test-cache linker creates, reuses, and repairs a dangling link', async () => {
    const { root } = await fixture();
    const extensionDir = path.join(root, 'extension');
    const cacheDir = path.join(root, 'cache');
    await fs.mkdir(extensionDir);
    (await linkVscodeTestCache({ extensionDir, cacheDir })).action.should.equal('created');
    (await linkVscodeTestCache({ extensionDir, cacheDir })).action.should.equal('unchanged');
    await fs.rmdir(cacheDir);
    (await linkVscodeTestCache({ extensionDir, cacheDir })).action.should.equal('unchanged');
    (await fs.stat(cacheDir)).isDirectory().should.equal(true);
    (await fs.realpath(path.join(extensionDir, '.vscode-test'))).should.equal(await fs.realpath(cacheDir));
});

it('test-cache linker refuses real directories and preserves their contents', async () => {
    const { root, write } = await fixture();
    await write('extension/.vscode-test/important.txt', 'keep');
    const options = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'cache'), replaceExistingLink: true };
    await linkVscodeTestCache(options).should.be.rejectedWith(/Refusing to replace/);
    (await fs.readFile(path.join(root, 'extension/.vscode-test/important.txt'), 'utf8')).should.equal('keep');
    await fs.stat(options.cacheDir).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
});

it('test-cache replacement requires opt-in and never removes cache contents', async () => {
    const { root, write } = await fixture();
    await fs.mkdir(path.join(root, 'extension'));
    const first = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'first') };
    await linkVscodeTestCache(first);
    await write('first/keep.txt', 'keep');
    const second = { ...first, cacheDir: path.join(root, 'second') };
    await linkVscodeTestCache(second).should.be.rejectedWith(/--replace/);
    (await fs.realpath(path.join(first.extensionDir, '.vscode-test'))).should.equal(await fs.realpath(first.cacheDir));
    (await linkVscodeTestCache({ ...second, replaceExistingLink: true })).action.should.equal('replaced');
    (await fs.readFile(path.join(root, 'first/keep.txt'), 'utf8')).should.equal('keep');
    (await fs.realpath(path.join(first.extensionDir, '.vscode-test'))).should.equal(await fs.realpath(second.cacheDir));
    (await fs.readdir(first.extensionDir)).should.deep.equal(['.vscode-test']);
});

it('test-cache linker rejects overlapping and invalid directories', async () => {
    const { root, write } = await fixture();
    await fs.mkdir(path.join(root, 'extension'));
    const extensionDir = path.join(root, 'extension');
    for (const cacheDir of [extensionDir, path.join(extensionDir, '.vscode-test'), path.join(extensionDir, '.vscode-test/child')]) {
        await linkVscodeTestCache({ extensionDir, cacheDir }).should.be.rejectedWith(/must not contain/);
    }
    await linkVscodeTestCache({ extensionDir, cacheDir: '' }).should.be.rejectedWith(/must not be empty/);
    await write('not-a-directory', 'file');
    await linkVscodeTestCache({ extensionDir, cacheDir: path.join(root, 'not-a-directory') }).should.be.rejected;
    await linkVscodeTestCache({ extensionDir: path.join(root, 'missing'), cacheDir: path.join(root, 'cache') })
        .should.be.rejected.and.eventually.have.property('code', 'ENOENT');
});

it('test-cache replacement restores the old link when rename fails', async () => {
    const { root } = await fixture();
    await fs.mkdir(path.join(root, 'extension'));
    const script = `
        import { should, use } from 'chai';
        import chaiAsPromised from 'chai-as-promised';
        import fs from 'node:fs/promises';
        import path from 'node:path';
        import { syncBuiltinESMExports } from 'node:module';
        import { linkVscodeTestCache } from '@microsoft/vscode-azext-eng/vscode-test/cache';
        use(chaiAsPromised);
        should();
        const root = ${JSON.stringify(root)};
        const options = { extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'first') };
        await linkVscodeTestCache(options);
        fs.rename = async () => { throw new Error('rename blocked'); };
        syncBuiltinESMExports();
        await linkVscodeTestCache({
            ...options, cacheDir: path.join(root, 'second'), replaceExistingLink: true
        }).should.be.rejectedWith(/rename blocked/);
        (await fs.realpath(path.join(options.extensionDir, '.vscode-test'))).should.equal(await fs.realpath(options.cacheDir));
        (await fs.readdir(options.extensionDir)).should.deep.equal(['.vscode-test']);
    `;
    await exec(process.execPath, ['--input-type=module', '-e', script], { cwd: packageDir });
});

it('test-cache linker resolves relative symlink targets against the link parent', async function () {
    if (process.platform === 'win32') {
        this.skip();
    }
    const { root } = await fixture();
    await fs.mkdir(path.join(root, 'extension'));
    await fs.mkdir(path.join(root, 'cache'));
    await fs.symlink('../cache', path.join(root, 'extension/.vscode-test'), 'dir');
    (await linkVscodeTestCache({ extensionDir: path.join(root, 'extension'), cacheDir: path.join(root, 'cache') })).action.should.equal('unchanged');
});

it('cache CLI honors the environment and reports refusal with a failure exit', async () => {
    const { root, write } = await fixture();
    await fs.mkdir(path.join(root, 'extension'));
    const cli = path.join(packageDir, 'dist/esm/vscode-test/linkTestCacheCli.js');
    const env = { ...process.env };
    env.VSCODE_TEST_CACHE_DIR = 'cache';
    const options = { cwd: root, env };
    const result = await exec(process.execPath, [cli, '--extension-dir', 'extension'], options);
    result.stdout.should.match(/Test cache created/);
    (await fs.realpath(path.join(root, 'extension/.vscode-test'))).should.equal(await fs.realpath(path.join(root, 'cache')));
    await write('other/.vscode-test/keep.txt', 'keep');
    await exec(process.execPath, [cli, '--extension-dir', 'other'], options).should.be.rejectedWith(/Refusing to replace/);
});

it('VS Code factories merge nested defaults and isolate mutable configuration', () => {
    const extra = {
        mocha: { ui: 'bdd', require: ['extra-hook'], reporterOptions: { nested: { enabled: true } } },
        env: { EXTRA: '1' },
        launchArgs: ['--disable-gpu'],
    } satisfies NonNullable<Parameters<typeof createVscodeTestConfig>[0]>;
    const first = createVscodeTestConfig(extra);
    const second = createVscodeTestConfig();
    first.should.have.nested.property('mocha.ui', 'bdd');
    first.should.have.nested.property('mocha.timeout', 10000);
    first.should.have.nested.property('mocha.require').that.deep.equals([...(baseConfig.mocha?.require ?? []), 'extra-hook']);
    first.should.have.nested.property('env.VSCODE_RUNNING_TESTS', '1');
    first.should.have.nested.property('env.EXTRA', '1');
    first.mocha!.require!.push('mutation');
    first.launchArgs?.push('mutation');
    extra.mocha.require.should.deep.equal(['extra-hook']);
    second.should.have.nested.property('mocha.require').that.does.not.include('mutation');
    second.should.have.property('launchArgs').that.does.not.include('mutation');
    should.not.equal(first.mocha?.reporterOptions, extra.mocha.reporterOptions);
    const reporterOptions = first.mocha!.reporterOptions as typeof extra.mocha.reporterOptions;
    reporterOptions.nested.enabled = false;
    extra.mocha.reporterOptions.nested.enabled.should.equal(true);
    should.not.equal(azExtTestConfig.mocha, azExtSrcTestConfig.mocha);
    azExtSrcTestConfig.should.have.property('workspaceFolder', 'src/test/test.code-workspace');
});

it('Node Mocha factory is isolated and runs ts/mts/cts with shared globals and extensionless imports', async () => {
    const { root, write } = await fixture();
    await fs.mkdir(path.join(root, 'node_modules/@microsoft'), { recursive: true });
    await fs.symlink(packageDir, path.join(root, 'node_modules/@microsoft/vscode-azext-eng'), 'junction');
    await write('.mocharc.json', JSON.stringify(createNodeMochaConfig()));
    await write('src/test/helper.ts', 'export const value = 1;');
    await write('src/test/example.test.ts', "import { value } from './helper'; enum Value { One = 1 } describe('ts', () => it('loads', () => expect(value).to.equal(Value.One)));");
    await write('src/test/example.test.mts', "describe('mts', () => it('loads', () => expect(true).to.equal(true)));");
    await write('src/test/example.test.cts', "describe('cts', () => it('loads', () => expect(true).to.equal(true)));");
    const result = await exec(process.execPath, [require.resolve('mocha/bin/mocha.js')], { cwd: root });
    result.stdout.should.match(/3 passing/);
    const options = { 'node-option': ['trace-warnings'], spec: ['test/**/*.ts'] };
    const config = createNodeMochaConfig(options);
    config['node-option']?.push('mutation');
    options['node-option'].should.deep.equal(['trace-warnings']);
    createNodeMochaConfig().should.have.property('node-option').that.does.not.include('mutation');
});

it('all ESLint presets ignore underscore-prefixed bindings but report other unused locals', async () => {
    const { root, write } = await fixture();
    await write('tsconfig.json', '{"compilerOptions":{"strict":true},"include":["*.ts"]}');
    await write('sample.ts', 'const _unused = 1; const unused = 2; try { throw new Error(); } catch (_error) {}');
    for (const preset of [azExtEslintRecommended, azExtEslintRecommendedTypeChecked, azExtEslintStrict, azExtEslintStrictTypeChecked]) {
        const eslint = new ESLint({
            cwd: root,
            overrideConfigFile: true,
            overrideConfig: [...preset, explicitTsProjectRuleConfig('./tsconfig.json', root)],
        });
        const [result] = await eslint.lintFiles(['sample.ts']);
        result.messages.some(message => message.fatal).should.equal(false, JSON.stringify(result.messages));
        const unused = result.messages.filter(message => message.ruleId === '@typescript-eslint/no-unused-vars');
        unused.should.have.lengthOf(1, JSON.stringify(result.messages));
        unused[0].message.should.match(/'unused'/);
        result.messages.some(message => message.ruleId === 'no-unused-vars').should.equal(false);
        result.messages.some(message => message.ruleId === '@typescript-eslint/naming-convention').should.equal(false);
    }
});

it('combined import restrictions preserve both boundaries and lazy patterns', async () => {
    const { root, write } = await fixture();
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
    restricted.map(message => message.line).should.deep.equal([2, 4]);
    should.exist(lazyImportRuleConfig(['@azure/*']).rules?.['@typescript-eslint/no-restricted-imports']);
});

it('browser factory excludes host configuration and composes caller options', async () => {
    const { root, write } = await fixture();
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
    config.should.have.property('platform', 'browser');
    config.should.have.property('format', 'esm');
    should.equal(config.external, undefined);
    should.equal(config.alias, undefined);
    should.equal(config.banner, undefined);
    should.exist(config.loader);
    should.exist(config.plugins);
    config.loader!.should.have.property('.css', 'css');
    config.loader!.should.have.property('.svg', 'file');
    config.plugins![1].should.equal(plugin);
    await build(config);
    pluginRan.should.equal(true);
    (await fs.stat(path.join(root, 'dist/entry.js'))).isFile().should.equal(true);
    config.plugins!.push(plugin);
    createWebviewEsbuildConfig().should.have.property('plugins').with.lengthOf(1);
});

it('browser factory selects production, watch, and debug settings from shared flags', async () => {
    const script = `
        import { createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
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
        const result = await exec(process.execPath, ['--input-type=module', '-e', script, '--', ...args], { cwd: packageDir, env });
        result.stdout.trim().should.equal(JSON.stringify(expected));
    }
});

it('Sass plugin resolves CSS assets and watches imported stylesheets', async () => {
    const { root, write } = await fixture();
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
        (await fs.readFile(path.join(root, 'dist/main.css'), 'utf8')).should.match(/color: red/);
        const updated = nextBuild();
        await write('styles/_variables.scss', '$color: blue;');
        await updated;
        const css = await fs.readFile(path.join(root, 'dist/main.css'), 'utf8');
        css.should.match(/color: blue/);
        css.should.match(/image-.*\.svg/);
    } finally {
        await ctx.dispose();
    }
});

it('Sass compilation errors fail the build', async () => {
    const { root, write } = await fixture();
    await write('broken.scss', '.root { color: $undefined; }');
    await build(createWebviewEsbuildConfig({
        absWorkingDir: root,
        entryPoints: ['broken.scss'],
        plugins: [sassPlugin()],
        logLevel: 'silent',
    })).should.be.rejectedWith(/Undefined variable/);
});

it('public helpers load through ESM package exports', async () => {
    const script = `
        import { should } from 'chai';
        const assertions = should();
        for (const [subpath, names] of [
            ['esbuild', ['copyPlugin', 'createWebviewEsbuildConfig']],
            ['esbuild/sass', ['sassPlugin']],
            ['eslint', ['explicitTsProjectRuleConfig', 'importRestrictionsRuleConfig']],
            ['vscode-test', ['createVscodeTestConfig']],
            ['vscode-test/cache', ['linkVscodeTestCache']],
            ['mocha/config', ['createNodeMochaConfig']]
        ]) {
            const api = await import('@microsoft/vscode-azext-eng/' + subpath);
            for (const name of names) {
                assertions.exist(api[name], name);
                api[name].should.be.a('function', name);
            }
        }
    `;
    await exec(process.execPath, ['--input-type=module', '-e', script], { cwd: packageDir });
});

it('ordinary esbuild ESM consumers type-check and load without the optional Sass peer', async () => {
    const { root, write } = await fixture();
    const installed = path.join(root, 'node_modules/@microsoft/vscode-azext-eng');
    await fs.mkdir(installed, { recursive: true });
    await fs.copyFile(path.join(packageDir, 'package.json'), path.join(installed, 'package.json'));
    await fs.cp(path.join(packageDir, 'dist/esm'), path.join(installed, 'dist/esm'), { recursive: true });
    await fs.symlink(path.join(packageDir, 'node_modules/esbuild'), path.join(root, 'node_modules/esbuild'), 'junction');
    const code = [
        "import { copyPlugin, createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';",
        "createWebviewEsbuildConfig({ plugins: [copyPlugin({ assets: [{ from: 'assets', to: 'assets' }] })] });",
    ].join('\n');
    await write('index.mts', code);
    await exec(process.execPath, [
        path.join(packageDir, 'node_modules', '@typescript', 'native', 'bin', 'tsc'),
        '--noEmit', '--module', 'nodenext', '--target', 'es2022', 'index.mts',
    ], { cwd: root });
    const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', `
        import { createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
        import { sassPlugin } from '@microsoft/vscode-azext-eng/esbuild/sass';
        createWebviewEsbuildConfig({ plugins: [sassPlugin()] });
        console.log(typeof sassPlugin);
    `], { cwd: root });
    stdout.trim().should.equal('function');
});
