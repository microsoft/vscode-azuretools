/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import DOMPurify from 'dompurify';
import { marked } from 'marked';

/**
 * Renders Markdown to a sanitized HTML string safe to inject via `dangerouslySetInnerHTML`.
 *
 * README content is fetched from arbitrary third-party template repositories, so the rendered
 * HTML must be sanitized before it reaches the DOM. We rely on `marked` for the Markdown→HTML
 * transform and `DOMPurify` to strip anything dangerous (script tags, inline event handlers,
 * `javascript:` URIs, etc.) — never roll a bespoke parser for untrusted input.
 *
 * Post-processing steps after sanitization:
 *   - Strip all `<img>` elements (README image paths are usually repo-relative and won't resolve
 *     under the webview CSP, and external images add a tracking/exfiltration vector).
 *   - For `<a>` elements: external `http(s)` links open in a new tab with
 *     `rel="noopener noreferrer"`; non-external links are dropped to their text content.
 */
export function renderMarkdown(md: string): string {
    const cleanedMarkdown = md.replace(/<!--[\s\S]*?-->/g, '').trim();
    const renderedHtml = marked.parse(cleanedMarkdown, {
        gfm: true,
        breaks: false,
        async: false,
    }) as string;
    const sanitizedHtml = DOMPurify.sanitize(renderedHtml, {
        USE_PROFILES: { html: true },
    });
    const document = new DOMParser().parseFromString(`<body>${sanitizedHtml}</body>`, 'text/html');
    for (const image of Array.from(document.body.querySelectorAll('img'))) {
        image.remove();
    }
    for (const link of Array.from(document.body.querySelectorAll('a'))) {
        const href = link.getAttribute('href') ?? '';
        if (/^https?:\/\//i.test(href)) {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        } else {
            link.replaceWith(document.createTextNode(link.textContent ?? ''));
        }
    }
    return document.body.innerHTML;
}

