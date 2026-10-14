/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, it } from 'mocha';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESLint } from 'eslint';
import { build, context, type BuildResult, type Plugin } from 'esbuild';
import { should as registerShould } from 'chai';
import { createNodeMochaConfig } from '@microsoft/vscode-azext-eng/mocha/config';
import { azExtTestConfig, azExtSrcTestConfig, baseConfig, createVscodeTestConfig } from '@microsoft/vscode-azext-eng/vscode-test';
import { linkVscodeTestCache } from '@microsoft/vscode-azext-eng/vscode-test/cache';
import {
    azExtEslintRecommended, azExtEslintRecommendedTypeChecked, azExtEslintStrict, azExtEslintStrictTypeChecked,
    explicitTsProjectRuleConfig, importRestrictionsRuleConfig, lazyImportRuleConfig,
} from '@microsoft/vscode-azext-eng/eslint';
import { autoEsbuildOrWatch, autoSelectEsbuildConfig, createWebviewEsbuildConfig, type EsbuildConfigs } from '@microsoft/vscode-azext-eng/esbuild';

const should = registerShould();
const exec = promisify(execFile);
const packageDir = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const fixtures: string[] = [];

afterEach(async () => {
    for (const root of fixtures.splice(0)) {
        await fs.rm(root, { recursive: true, force: true });
    }
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

describe('TypeScript compilers', () => {
    it('ships native TypeScript 7 for consumer builds while ESLint resolves the TypeScript 6 API', async () => {
        const manifest = JSON.parse(await fs.readFile(path.join(packageDir, 'package.json'), 'utf8')) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        manifest.dependencies['@typescript/native'].should.match(/^npm:typescript@7\./);
        manifest.dependencies.typescript.should.match(/^~6\./);
        manifest.devDependencies.should.not.have.property('@typescript/native');

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
});

describe('VS Code test cache', () => {
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

    it('test-cache linker reports an unavailable filesystem root without retrying it', async () => {
        const script = `
        import { should, use } from 'chai';
        import chaiAsPromised from 'chai-as-promised';
        import fs from 'node:fs/promises';
        import path from 'node:path';
        import { syncBuiltinESMExports } from 'node:module';
        import { linkVscodeTestCache } from '@microsoft/vscode-azext-eng/vscode-test/cache';
        use(chaiAsPromised);
        should();
        const root = path.parse(process.cwd()).root;
        const cacheDir = path.join(root, 'azext-unavailable-cache');
        const realpath = fs.realpath;
        const missing = Object.assign(new Error('unavailable root'), { code: 'ENOENT' });
        let rootCalls = 0;
        fs.realpath = async file => {
            if (file === cacheDir || file === root) {
                if (file === root && ++rootCalls > 1) throw new Error('root retried');
                throw missing;
            }
            return realpath(file);
        };
        syncBuiltinESMExports();
        await linkVscodeTestCache({ cacheDir }).should.be.rejectedWith('unavailable root')
            .and.eventually.have.property('code', 'ENOENT');
        rootCalls.should.equal(1);
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
        const cli = path.join(packageDir, 'dist/cjs/src/vscode-test/linkTestCacheCli.js');
        const env = { ...process.env };
        env.VSCODE_TEST_CACHE_DIR = 'cache';
        const options = { cwd: root, env };
        const result = await exec(process.execPath, [cli, '--extension-dir', 'extension'], options);
        result.stdout.should.match(/Test cache created/);
        (await fs.realpath(path.join(root, 'extension/.vscode-test'))).should.equal(await fs.realpath(path.join(root, 'cache')));
        await write('other/.vscode-test/keep.txt', 'keep');
        await exec(process.execPath, [cli, '--extension-dir', 'other'], options).should.be.rejectedWith(/Refusing to replace/);
    });
});

describe('Test configuration', () => {
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

    it('Node Mocha factory discovers ts/mts/cts across layouts, ignores dependencies, and preserves ESM/import and CJS/require resolution', async () => {
        const { root, write } = await fixture();
        await fs.mkdir(path.join(root, 'node_modules/@microsoft'), { recursive: true });
        await fs.symlink(packageDir, path.join(root, 'node_modules/@microsoft/vscode-azext-eng'), 'junction');
        await write('.mocharc.cjs', [
            "const { createNodeMochaConfig } = require('@microsoft/vscode-azext-eng/mocha/config');",
            'module.exports = createNodeMochaConfig();',
        ].join('\n'));
        await write('src/test/helper.ts', 'export const value = 1;');
        await write('src/test/helper.js', 'module.exports.value = 2;');
        await write('src/test/example.test.ts', "import { value } from './helper'; enum Value { One = 1 } describe('ts', () => it('loads', () => { expect(value).to.equal(Value.One); value.should.equal(Value.One); }));");
        await write('src/test/example.test.mts', "import { value } from './helper.js'; describe('mts', () => it('loads', async () => { expect(value).to.equal(2); await Promise.reject(new Error('expected')).should.be.rejectedWith('expected'); }));");
        await write('src/test/example.test.cts', "const { value } = require('./helper'); describe('cts', () => it('loads', () => expect(value).to.equal(2)));");
        await write('root.test.ts', "describe('root', () => it('loads', () => { expect(true).to.equal(true); should.exist(true); should.not.exist(null); }));");
        await write('test/example.test.mts', "describe('test directory', () => it('loads', () => expect(true).to.equal(true)));");
        await write('node_modules/dependency/unexpected.test.ts', "throw new Error('Dependency tests must not run');");
        await write('packages/nested/node_modules/dependency/unexpected.test.cts', "throw new Error('Nested dependency tests must not run');");
        await write('test/compiled.test.js', "throw new Error('Compiled JavaScript tests must not run');");
        const result = await exec(process.execPath, [require.resolve('mocha/bin/mocha.js')], { cwd: root });
        result.stdout.should.match(/5 passing/);
        const options = { 'node-option': ['trace-warnings'], spec: ['test/**/*.ts'] };
        const config = createNodeMochaConfig(options);
        config.should.have.property('spec').that.deep.equals(options.spec);
        config['node-option']?.push('mutation');
        options['node-option'].should.deep.equal(['trace-warnings']);
        createNodeMochaConfig().should.have.property('node-option').that.does.not.include('mutation');
    });
});

describe('ESLint helpers', () => {
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
});

describe('Ordered builds', () => {
    it('does not start builds or announce readiness for empty or omitted configurations', async () => {
        const messages: unknown[][] = [];
        const log = console.log;
        console.log = (...args: unknown[]) => {
            messages.push(args);
        };

        try {
            await autoEsbuildOrWatch({});
            await autoEsbuildOrWatch({ telemetry: undefined, omitted: undefined });
        } finally {
            console.log = log;
        }

        messages.should.have.lengthOf(0);
    });

    it('builds any number of bundles in order and writes separate metadata', async () => {
        const { root, write } = await fixture();
        const defaults = autoSelectEsbuildConfig();
        Object.keys(defaults).should.deep.equal(['extension', 'telemetry']);
        defaults.telemetry!.should.have.property('metafile', false);
        defaults.extension = { ...defaults.extension };
        defaults.extension.alias = { example: './example.ts' };
        defaults.extension.alias.should.have.property('example', './example.ts');
        should.equal(autoSelectEsbuildConfig(false, false).telemetry, undefined);
        const messages: string[] = [];
        const configs: EsbuildConfigs = Object.fromEntries([0, 1, 2].map(index => [
            `bundle${index}`,
            {
                absWorkingDir: root,
                stdin: { contents: `export const value = ${index};`, loader: 'js' as const },
                outfile: `dist/bundle${index}.js`,
                metafile: index !== 0,
                plugins: [{
                    name: 'ordered-test',
                    setup(build) {
                        build.onStart(async () => {
                            if (index > 0) {
                                (await fs.readFile(path.join(root, `finished${index - 1}`), 'utf8')).should.equal('done');
                            }
                        });
                        build.onEnd(async () => {
                            await write(`finished${index}`, 'done');
                            messages.filter(message => message.startsWith('esbuild finished')).should.have.lengthOf(0);
                        });
                    },
                } satisfies Plugin],
            },
        ] as const));
        const log = console.log;
        console.log = (...args: unknown[]) => {
            messages.push(args.join(' '));
        };
        try {
            await autoEsbuildOrWatch(configs);
        } finally {
            console.log = log;
        }

        messages.should.have.lengthOf(2);
        messages[0].should.equal('esbuild started');
        messages[1].should.match(/^esbuild finished in \d+ milliseconds$/);
        await fs.stat(path.join(root, 'esbuild.bundle0.meta.json')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');
        for (const index of [1, 2]) {
            const metadata = JSON.parse(await fs.readFile(path.join(root, `esbuild.bundle${index}.meta.json`), 'utf8')) as { outputs: Record<string, unknown> };
            Object.keys(metadata.outputs).should.deep.equal([`dist/bundle${index}.js`]);
        }
    });

    it('rejects invalid or duplicate names before starting any builds and identifies build failures', async () => {
        const { root } = await fixture();
        const config = {
            absWorkingDir: root,
            stdin: { contents: 'export const value = 1;', loader: 'js' as const },
            outfile: 'dist/should-not-build.js',
            logLevel: 'silent' as const,
        };

        for (const name of ['', '../outside', 'nested/name', 'nested\\name', 'bad:name']) {
            await autoEsbuildOrWatch({ valid: config, [name]: config })
                .should.be.rejectedWith(/filename-safe/);
        }

        await autoEsbuildOrWatch({ duplicate: config, Duplicate: config })
            .should.be.rejectedWith(/Duplicate bundle name/);
        await fs.stat(path.join(root, 'dist')).should.be.rejected.and.eventually.have.property('code', 'ENOENT');

        try {
            await autoEsbuildOrWatch({
                'broken-extension': { ...config, stdin: { contents: 'invalid syntax =', loader: 'js' } },
            });
            should.fail('Expected build failure');
        } catch (error) {
            if (!(error instanceof Error)) {
                throw error;
            }

            error.message.should.match(/Failed to build bundle "broken-extension":.*Expected/s);
            error.should.have.property('cause').that.is.an.instanceOf(Error);
        }
    });

    it('coordinates readiness across initial builds, overlapping rebuilds, and error recovery', async () => {
        const { root } = await fixture();
        const script = `
        import assert from 'node:assert/strict';
        import fs from 'node:fs/promises';
        import path from 'node:path';
        import { autoEsbuildOrWatch, createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
        const root = ${JSON.stringify(root)};
        const messages = [];
        const log = console.log;
        let finishedCycle;
        console.log = (...args) => {
            const message = args.join(' ');
            log(...args);
            if (message.startsWith('[watch] build ')) {
                messages.push(message);
                if (message.startsWith('[watch] build finished')) {
                    finishedCycle?.();
                }
            }
        };
        const starts = [Promise.withResolvers(), Promise.withResolvers()];
        const holds = [Promise.withResolvers(), Promise.withResolvers()];
        const ends = [Promise.withResolvers(), Promise.withResolvers()];
        const errors = [0, 0];
        let overlapping = false;
        let initialized = false;
        const configs = {};
        for (const index of [0, 1]) {
            await fs.writeFile(path.join(root, 'entry' + index + '.ts'), 'export const value = 1;');
            configs['view' + index] = createWebviewEsbuildConfig({
                absWorkingDir: root,
                entryPoints: ['entry' + index + '.ts'],
                outdir: 'dist/view' + index,
                metafile: true,
                logLevel: 'silent',
                plugins: [{
                    name: 'readiness-test',
                    setup(build) {
                        build.onStart(async () => {
                            if (overlapping) {
                                starts[index].resolve();
                                await holds[index].promise;
                            }
                        });
                        build.onEnd(result => {
                            errors[index] = result.errors.length;
                            if (!initialized) {
                                assert.equal(messages.filter(message => message.includes('finished')).length, 0);
                            }
                            if (overlapping) {
                                ends[index].resolve();
                            }
                        });
                    }
                }]
            });
        }
        function nextFinish() {
            return new Promise(resolve => {
                finishedCycle = resolve;
            });
        }

        function assertOneCycle() {
            assert.equal(messages.length, 2);
            assert.equal(messages[0], '[watch] build started');
            assert.match(messages[1], /^\\[watch\\] build finished in \\d+ milliseconds$/);
        }
        try {
            await autoEsbuildOrWatch(configs);
            initialized = true;
            assertOneCycle();

            messages.length = 0;
            overlapping = true;
            const overlapFinished = nextFinish();
            await Promise.all([0, 1].map(index => fs.writeFile(path.join(root, 'entry' + index + '.ts'), 'export const value = 2;')));
            await Promise.all(starts.map(start => start.promise));
            assert.deepEqual(messages, ['[watch] build started']);
            holds[0].resolve();
            await ends[0].promise;
            assert.deepEqual(messages, ['[watch] build started']);
            holds[1].resolve();
            await overlapFinished;
            assertOneCycle();
            for (const index of [0, 1]) {
                const metadata = JSON.parse(await fs.readFile(path.join(root, 'esbuild.view' + index + '.meta.json'), 'utf8'));
                const output = 'dist/view' + index + '/entry' + index + '.js';
                const content = await fs.readFile(path.join(root, output));
                assert.equal(metadata.outputs[output].bytes, content.length);
                assert.match(content.toString(), /value = 2/);
            }

            overlapping = false;
            messages.length = 0;
            const failed = nextFinish();
            await fs.writeFile(path.join(root, 'entry0.ts'), 'invalid syntax =');
            await failed;
            assertOneCycle();
            assert.equal(errors[0], 1);

            messages.length = 0;
            const recovered = nextFinish();
            await fs.writeFile(path.join(root, 'entry0.ts'), 'export const value = 3;');
            await recovered;
            assertOneCycle();
            assert.equal(errors[0], 0);
            console.log('aggregate readiness verified');
        } finally {
            process.emit('SIGTERM');
        }
    `;
        const result = await exec(process.execPath, ['--input-type=module', '-e', script, '--', '--watch'], { cwd: packageDir, timeout: 1800 });
        result.stdout.should.include('aggregate readiness verified');
    });

    it('awaits initial watch builds and disposes every context on shutdown or a later failure', async () => {
        const { root } = await fixture();
        const script = `
        import assert from 'node:assert/strict';
        import fs from 'node:fs/promises';
        import path from 'node:path';
        import { autoEsbuildOrWatch } from '@microsoft/vscode-azext-eng/esbuild';
        const root = ${JSON.stringify(root)};
        const before = process.listenerCount('SIGTERM');
        const counts = [0, 0, 0];
        const telemetryDisposed = Promise.withResolvers();
        let rebuilt;
        await fs.writeFile(path.join(root, 'watched.ts'), 'export const value = 1;');
        const configs = Object.fromEntries([1, 2, 0].map(index => [
            index === 0 ? 'telemetry' : 'bundle' + index,
            {
                absWorkingDir: root,
                stdin: { contents: 'export const value = 1;', loader: 'js' },
                ...(index === 1 ? { stdin: undefined, entryPoints: ['watched.ts'] } : {}),
                outfile: 'dist/bundle' + index + '.js',
                metafile: true,
                plugins: [{
                    name: 'watch-order',
                    setup(build) {
                        build.onStart(async () => {
                            if (index) {
                                await fs.access(path.join(root, 'dist/bundle' + (index - 1) + '.js'));
                            }
                        });
                        build.onEnd(() => {
                            counts[index]++;
                            if (index === 1) {
                                rebuilt?.();
                            }
                        });
                        build.onDispose(() => {
                            if (index === 0) {
                                telemetryDisposed.resolve();
                            }
                        });
                    }
                }]
            }
        ]));
        try {
            await autoEsbuildOrWatch(configs);
            await telemetryDisposed.promise;
            await assert.rejects(fs.stat(path.join(root, 'esbuild.telemetry.meta.json')), { code: 'ENOENT' });
            assert.equal(configs.telemetry.metafile, true);
            for (const index of [1, 2]) {
                await fs.access(path.join(root, 'esbuild.bundle' + index + '.meta.json'));
            }

            assert.equal(process.listenerCount('SIGTERM'), before + 1);
            const updated = new Promise(resolve => {
                rebuilt = resolve;
            });
            await fs.writeFile(path.join(root, 'watched.ts'), 'export const value = "updated";');
            await updated;
            assert.deepEqual(counts, [1, 2, 1]);
            rebuilt = undefined;
            process.emit('SIGTERM');
            assert.equal(process.listenerCount('SIGTERM'), before);

            await assert.rejects(autoEsbuildOrWatch({
                bundle1: configs.bundle1,
                syntax: {
                    stdin: { contents: 'invalid syntax =', loader: 'js' },
                    write: false,
                    logLevel: 'silent'
                }
            }), /Failed to build bundle "syntax":.*Expected/s);
            assert.equal(process.listenerCount('SIGTERM'), before);

            await assert.rejects(autoEsbuildOrWatch({
                bundle2: configs.bundle2,
                setup: {
                    plugins: [{
                        name: 'broken-setup',
                        setup() { throw new Error('setup failed'); }
                    }],
                    logLevel: 'silent'
                }
            }), /Failed to build bundle "setup":.*setup failed/s);
            assert.equal(process.listenerCount('SIGTERM'), before);

            await fs.mkdir(path.join(root, 'esbuild.blocked-metadata.meta.json'));
            await assert.rejects(autoEsbuildOrWatch({
                'blocked-metadata': configs.bundle2
            }), /Failed to build bundle "blocked-metadata":.*(EISDIR|EPERM)/s);
            assert.equal(process.listenerCount('SIGTERM'), before);

            await autoEsbuildOrWatch({
                stop: {
                    ...configs.telemetry,
                    plugins: [{
                        name: 'stop-during-startup',
                        setup(build) {
                            build.onStart(() => { process.emit('SIGTERM'); });
                        }
                    }]
                },
                'must-not-start': {
                    plugins: [{
                        name: 'must-not-start',
                        setup() { throw new Error('Started after shutdown'); }
                    }]
                }
            });
            assert.equal(process.listenerCount('SIGTERM'), before);
            console.log('watch cleanup verified');
        } finally {
            process.emit('SIGTERM');
        }
    `;
        const result = await exec(process.execPath, ['--input-type=module', '-e', script, '--', '--watch'], { cwd: packageDir, timeout: 1800 });
        result.stdout.should.include('watch cleanup verified');
        const metadata = JSON.parse(await fs.readFile(path.join(root, 'esbuild.bundle1.meta.json'), 'utf8')) as { inputs: Record<string, { bytes: number }> };
        metadata.inputs['watched.ts'].bytes.should.equal('export const value = "updated";'.length);
    });
});

describe('Webview builds', () => {
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
        createWebviewEsbuildConfig({ sass: false }).should.have.property('plugins').with.lengthOf(0);
    });

    it('browser and extension factories select consistent production, watch, and debug settings', async () => {
        const script = `
        import assert from 'node:assert/strict';
        import { autoSelectEsbuildConfig, createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
        const configs = [createWebviewEsbuildConfig()];
        for (const esm of [false, true]) {
            const { telemetry, extension } = autoSelectEsbuildConfig(esm);
            assert.equal(telemetry.minify, true);
            assert.equal(telemetry.sourcemap, false);
            assert.equal(telemetry.metafile, false);
            assert.equal(extension.format, esm ? 'esm' : 'cjs');
            configs.push(extension);
        }
        console.log(JSON.stringify(configs.map(config => ({ minify: config.minify, sourcemap: config.sourcemap, metafile: config.metafile }))));
    `;
        for (const [args, debug, expected] of [
            [[], '0', { minify: true, sourcemap: false }],
            [[], '1', { minify: true, sourcemap: false, metafile: true }],
            [['--watch'], '0', { minify: false, sourcemap: 'linked' }],
            [['--watch'], '1', { minify: false, sourcemap: 'linked', metafile: true }],
        ] as const) {
            const env = { ...process.env };
            env.DEBUG_ESBUILD = debug;
            const result = await exec(process.execPath, ['--input-type=module', '-e', script, '--', ...args], { cwd: packageDir, env });
            result.stdout.trim().should.equal(JSON.stringify([expected, expected, expected]));
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
            plugins: [{
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
            logLevel: 'silent',
        })).should.be.rejectedWith(/Undefined variable/);
    });

    it('Sass watch recovers from initial and subsequent imported-file errors', async () => {
        const { root, write } = await fixture();
        await write('styles/_variables.scss', '$width: ;');
        await write('styles/_colors.scss', '$color: red;');
        await write('styles/main.scss', '@use "variables"; @use "colors"; .root { width: variables.$width; color: colors.$color; }');
        let finished: ((result: BuildResult) => void) | undefined;
        let timeout: NodeJS.Timeout | undefined;
        function nextBuild(): Promise<BuildResult> {
            return new Promise((resolve, reject) => {
                timeout = setTimeout(() => { reject(new Error('Sass error recovery timed out')); }, 1000);
                finished = result => { clearTimeout(timeout); resolve(result); };
            });
        }
        const ctx = await context(createWebviewEsbuildConfig({
            absWorkingDir: root,
            entryPoints: ['styles/main.scss'],
            minify: false,
            logLevel: 'silent',
            plugins: [{
                name: 'watch-errors-test',
                setup(build) { build.onEnd(result => { finished?.(result); }); },
            }],
        }));
        try {
            const initial = nextBuild();
            await ctx.watch();
            (await initial).errors.should.have.lengthOf(1);
            const recovered = nextBuild();
            await write('styles/_variables.scss', '$width: 10px;');
            (await recovered).errors.should.have.lengthOf(0);
            const broken = nextBuild();
            await write('styles/_variables.scss', '$width: ;');
            (await broken).errors.should.have.lengthOf(1);
            const otherDependency = nextBuild();
            await write('styles/_colors.scss', '$color: blue;');
            (await otherDependency).errors.should.have.lengthOf(1);
            const fixed = nextBuild();
            await write('styles/_variables.scss', '$width: 20px;');
            (await fixed).errors.should.have.lengthOf(0);
            const css = await fs.readFile(path.join(root, 'dist/main.css'), 'utf8');
            css.should.match(/width: 20px/);
            css.should.match(/color: blue/);
        } finally {
            clearTimeout(timeout);
            await ctx.dispose();
        }
    });
});

describe('Package exports', () => {
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

    it('ordinary esbuild consumers type-check and load without the optional Sass peer', async () => {
        const { root, write } = await fixture();
        const installed = path.join(root, 'node_modules/@microsoft/vscode-azext-eng');
        await fs.mkdir(installed, { recursive: true });
        await fs.copyFile(path.join(packageDir, 'package.json'), path.join(installed, 'package.json'));
        await fs.cp(path.join(packageDir, 'dist/esm'), path.join(installed, 'dist/esm'), { recursive: true });
        await fs.cp(path.join(packageDir, 'dist/cjs'), path.join(installed, 'dist/cjs'), { recursive: true });
        await fs.symlink(path.join(packageDir, 'node_modules/esbuild'), path.join(root, 'node_modules/esbuild'), 'junction');
        const code = [
            "import { autoEsbuildOrWatch, autoSelectEsbuildConfig, copyPlugin, createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';",
            'const configs = autoSelectEsbuildConfig(false, false);',
            "configs.extension.alias = { example: './example.ts' };",
            "configs.webview = createWebviewEsbuildConfig({ plugins: [copyPlugin({ assets: [{ from: 'assets', to: 'assets' }] })] });",
            'void autoEsbuildOrWatch(configs);',
        ].join('\n');
        await write('index.mts', code);
        await exec(process.execPath, [
            path.join(packageDir, 'node_modules', '@typescript', 'native', 'bin', 'tsc'),
            '--noEmit', '--module', 'nodenext', '--target', 'es2022', 'index.mts',
        ], { cwd: root });
        const { stdout } = await exec(process.execPath, ['--input-type=module', '-e', `
        import { createWebviewEsbuildConfig } from '@microsoft/vscode-azext-eng/esbuild';
        import { build } from 'esbuild';
        import fs from 'node:fs/promises';
        import { createRequire } from 'node:module';
        const cjs = createRequire(import.meta.url)('@microsoft/vscode-azext-eng/esbuild');
        await fs.writeFile('style.scss', '.root { color: red; }');
        for (const factory of [createWebviewEsbuildConfig, cjs.createWebviewEsbuildConfig]) {
            await build(factory({ stdin: { contents: 'export const value = 1;', loader: 'js' }, write: false, logLevel: 'silent' }));
            try {
                await build(factory({ entryPoints: ['style.scss'], write: false, logLevel: 'silent' }));
                throw new Error('Unexpected Sass success');
            } catch (error) {
                if (!error.message.includes('Install it with npm install --save-dev sass')) throw error;
            }
        }
        console.log('lazy Sass verified');
    `], { cwd: root });
        stdout.trim().should.match(/lazy Sass verified$/);
    });
});
