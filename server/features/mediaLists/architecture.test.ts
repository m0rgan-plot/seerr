import assert from 'node:assert';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const FEATURE_ROOT = join(__dirname);
const DOMAIN_ROOT = join(FEATURE_ROOT, 'domain');

const tsFilesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      return tsFilesUnder(path);
    }
    return path.endsWith('.ts') || path.endsWith('.tsx') ? [path] : [];
  });

const existsOrEmpty = (dir: string): string[] => {
  try {
    return tsFilesUnder(dir);
  } catch {
    return [];
  }
};

const relative = (path: string) => path.slice(FEATURE_ROOT.length + 1);

// The layering is the reason the domain can be tested without a database, so it is
// worth failing a build over rather than trusting review to catch a stray import.
describe('mediaLists architecture', () => {
  const domainFiles = tsFilesUnder(DOMAIN_ROOT);

  it('has domain files to check', () => {
    assert.ok(domainFiles.length > 0);
  });

  const forbidden = [
    { pattern: /from 'typeorm'/, reason: 'TypeORM' },
    { pattern: /@server\/entity/, reason: 'a TypeORM entity' },
    { pattern: /data\/orm/, reason: 'a persistence record' },
    { pattern: /getRepository/, reason: 'the TypeORM repository helper' },
    { pattern: /from 'express'/, reason: 'Express' },
  ];

  for (const { pattern, reason } of forbidden) {
    it(`keeps ${reason} out of the domain layer`, () => {
      const offenders = domainFiles.filter((file) =>
        pattern.test(readFileSync(file, 'utf8'))
      );

      assert.deepStrictEqual(
        offenders.map(relative),
        [],
        `${reason} must stay in the data or presentation layer`
      );
    });
  }

  it('keeps the ORM records out of the domain and presentation layers', () => {
    const ormFiles = tsFilesUnder(join(FEATURE_ROOT, 'data', 'orm')).map(
      relative
    );

    // Every Record lives in one place, so a future contributor cannot quietly start a
    // second collection of entities elsewhere in the feature.
    const strayRecords = tsFilesUnder(FEATURE_ROOT)
      .map(relative)
      .filter((file) => file.endsWith('Record.ts') && !ormFiles.includes(file));

    assert.deepStrictEqual(strayRecords, []);
  });
});

// The frontend has the same rule and no test runner of its own, so it is checked from
// here: only the api and mapper files may know the wire shape, and components reach for
// hooks rather than axios.
describe('watchlists frontend architecture', () => {
  const FRONTEND_ROOT = join(__dirname, '../../../src');
  const DOMAIN = join(FRONTEND_ROOT, 'domain/mediaLists');
  const COMPONENTS = join(FRONTEND_ROOT, 'components/Watchlists');
  const PAGES = join(FRONTEND_ROOT, 'pages/watchlists');

  const asRelative = (path: string) => path.slice(FRONTEND_ROOT.length + 1);

  // Hooks legitimately name the wire types to type their fetch, so the meaningful rule is
  // that the domain models themselves stay independent of the transport rather than being
  // aliases for whatever the API happens to return today.
  it('keeps the wire shape out of the domain models', () => {
    const offenders = existsOrEmpty(join(DOMAIN, 'models')).filter((file) =>
      /mediaLists\/api\/dto|mediaListInterfaces/.test(
        readFileSync(file, 'utf8')
      )
    );

    assert.deepStrictEqual(offenders.map(asRelative), []);
  });

  it('keeps dto types and axios out of the components and pages', () => {
    const presentation = [
      ...existsOrEmpty(COMPONENTS),
      ...existsOrEmpty(PAGES),
    ];

    const offenders = presentation.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /from 'axios'/.test(source) ||
        /mediaLists\/api\//.test(source) ||
        /mediaListInterfaces/.test(source)
      );
    });

    assert.deepStrictEqual(offenders.map(asRelative), []);
  });
});
