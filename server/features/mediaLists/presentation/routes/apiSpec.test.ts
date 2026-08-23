import mediaListItemRoutes from '@server/features/mediaLists/presentation/routes/mediaListItemRoutes';
import mediaListRoutes from '@server/features/mediaLists/presentation/routes/mediaListRoutes';
import mediaListWatchRoutes from '@server/features/mediaLists/presentation/routes/mediaListWatchRoutes';
import type { Router } from 'express';
import yaml from 'js-yaml';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// The app runs every request through express-openapi-validator with validateRequests on,
// so an endpoint missing from seerr-api.yml is rejected with a 404 no matter how the
// handler behaves. Route tests mount the router directly and never see that, which is
// exactly how a working endpoint can still be unreachable in the real app.
const SPEC_PATH = join(__dirname, '../../../../../seerr-api.yml');

const MOUNTS: { prefix: string; router: Router }[] = [
  { prefix: '', router: mediaListRoutes },
  { prefix: '/:mediaListId/items', router: mediaListItemRoutes },
  { prefix: '/:mediaListId/items/:itemId', router: mediaListWatchRoutes },
];

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

const toSpecPath = (path: string) =>
  `/mediaLists${path}`.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '') ||
  '/mediaLists';

const registeredEndpoints = () =>
  MOUNTS.flatMap(({ prefix, router }) =>
    (router.stack as RouteLayer[])
      .filter((layer) => layer.route)
      .flatMap((layer) => {
        const path = toSpecPath(`${prefix}${layer.route!.path}`);
        return Object.keys(layer.route!.methods)
          .filter((method) => method !== '_all')
          .map((method) => ({ path, method }));
      })
  );

describe('media list OpenAPI spec', () => {
  const spec = yaml.load(readFileSync(SPEC_PATH, 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, unknown> };
  };

  it('finds routes to check', () => {
    assert.ok(registeredEndpoints().length >= 14);
  });

  it('declares every registered route', () => {
    const missing = registeredEndpoints().filter(
      ({ path, method }) => !spec.paths[path]?.[method]
    );

    assert.deepStrictEqual(
      missing.map(({ method, path }) => `${method.toUpperCase()} ${path}`),
      [],
      'these endpoints would be rejected by the request validator'
    );
  });

  it('does not declare routes that no longer exist', () => {
    const registered = new Set(
      registeredEndpoints().map(({ path, method }) => `${method} ${path}`)
    );

    const stale = Object.entries(spec.paths)
      .filter(([path]) => path.startsWith('/mediaLists'))
      .flatMap(([path, methods]) =>
        Object.keys(methods)
          .filter((method) => !registered.has(`${method} ${path}`))
          .map((method) => `${method.toUpperCase()} ${path}`)
      );

    assert.deepStrictEqual(stale, []);
  });

  it('resolves every schema the media list paths reference', () => {
    const declared = JSON.stringify(
      Object.fromEntries(
        Object.entries(spec.paths).filter(([path]) =>
          path.startsWith('/mediaLists')
        )
      )
    );

    const referenced = [
      ...declared.matchAll(/#\/components\/schemas\/(\w+)/g),
    ].map((match) => match[1]);

    const unresolved = [...new Set(referenced)].filter(
      (name) => !spec.components.schemas[name]
    );

    assert.deepStrictEqual(unresolved, []);
  });
});
