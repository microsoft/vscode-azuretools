/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createApplyFilters } from '../../src/webview/TemplateGallery/applyFilters';
import type { FilterState, IProjectTemplate } from '../../src/webview/TemplateGallery/types';

const languageFilterMap: Record<string, string> = {
    'CSharp': 'dotnet',
    'Python': 'python',
    'TypeScript': 'typescript',
};

const languageDisplayNames: Record<string, string> = {
    'CSharp': '.NET',
    'Python': 'Python',
    'TypeScript': 'TypeScript',
};

function template(overrides: Partial<IProjectTemplate>): IProjectTemplate {
    return {
        id: overrides.id ?? 'id',
        displayName: overrides.displayName ?? 'Template',
        shortDescription: overrides.shortDescription ?? '',
        repositoryUrl: overrides.repositoryUrl ?? 'https://example.com/repo',
        languages: overrides.languages ?? [],
        ...overrides,
    } as IProjectTemplate;
}

function emptyFilters(overrides: Partial<FilterState> = {}): FilterState {
    return { language: 'all', useCase: 'all', resource: 'all', search: '', ...overrides };
}

suite('(unit) applyFilters', () => {
    const apply = createApplyFilters(languageFilterMap, languageDisplayNames);

    const dotnetHttp = template({ id: 'dotnet-http', displayName: 'HTTP Trigger', languages: ['CSharp'] });
    const dotnetTimer = template({ id: 'dotnet-timer', displayName: 'Timer Trigger', languages: ['CSharp'] });
    const pythonHttp = template({ id: 'python-http', displayName: 'HTTP Trigger', languages: ['Python'] });
    const aspire = template({ id: 'aspire', displayName: 'Durable Functions with .NET Aspire', languages: ['CSharp'] });
    const all = [dotnetHttp, dotnetTimer, pythonHttp, aspire];

    test('searching ".NET" matches the same set as the .NET language filter', () => {
        const byFilter = apply(all, emptyFilters({ language: 'dotnet' })).map(t => t.id).sort();
        const bySearch = apply(all, emptyFilters({ search: '.NET' })).map(t => t.id).sort();

        assert.deepStrictEqual(bySearch, byFilter);
        assert.deepStrictEqual(bySearch, ['aspire', 'dotnet-http', 'dotnet-timer']);
    });

    test('display-name search is case-insensitive', () => {
        const ids = apply(all, emptyFilters({ search: '.net' })).map(t => t.id).sort();
        assert.deepStrictEqual(ids, ['aspire', 'dotnet-http', 'dotnet-timer']);
    });

    test('search matches the raw language key', () => {
        const ids = apply(all, emptyFilters({ search: 'python' })).map(t => t.id);
        assert.deepStrictEqual(ids, ['python-http']);
    });

    test('search still matches display name and description', () => {
        const ids = apply(all, emptyFilters({ search: 'aspire' })).map(t => t.id);
        assert.deepStrictEqual(ids, ['aspire']);
    });

    test('empty filters return all templates', () => {
        assert.strictEqual(apply(all, emptyFilters()).length, all.length);
    });

    test('search does not throw when a template has no languages', () => {
        const noLangs = { ...template({ id: 'no-langs', displayName: 'Bare' }), languages: undefined } as unknown as IProjectTemplate;
        assert.doesNotThrow(() => apply([noLangs], emptyFilters({ search: '.net' })));
    });

    test('language filter does not throw when a template has no languages', () => {
        const noLangs = { ...template({ id: 'no-langs', displayName: 'Bare' }), languages: undefined } as unknown as IProjectTemplate;
        assert.doesNotThrow(() => apply([noLangs], emptyFilters({ language: 'dotnet' })));
        assert.deepStrictEqual(apply([noLangs], emptyFilters({ language: 'dotnet' })), []);
    });
});
