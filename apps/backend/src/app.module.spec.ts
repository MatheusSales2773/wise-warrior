import 'reflect-metadata';
import { AppModule } from './app.module';

type ModuleRef = object | (() => unknown) | undefined;

const isForwardRef = (entry: unknown): entry is { forwardRef: () => unknown } =>
  typeof entry === 'object' && entry !== null && 'forwardRef' in entry;

/**
 * Auth, Users, Progression, Realtime, Guilds and Raids import each other. A direct (non-forwardRef) import that
 * lands in a file-level cycle is `undefined` when its module is decorated, and Nest fails at boot.
 */
describe('AppModule wiring', () => {
  it('has no undefined module in the import graph', () => {
    const seen = new Set<unknown>();
    const undefinedImports: string[] = [];
    const visit = (module: object, name: string) => {
      if (seen.has(module)) return;
      seen.add(module);
      const imports = (Reflect.getMetadata('imports', module) ?? []) as ModuleRef[];
      imports.forEach((entry, index) => {
        const resolved = isForwardRef(entry) ? entry.forwardRef() : entry;
        if (resolved === undefined) {
          undefinedImports.push(`${name}.imports[${index}]`);
          return;
        }
        const target = (resolved as { module?: object }).module ?? resolved;
        visit(target as object, (target as { name?: string }).name ?? name);
      });
    };
    visit(AppModule, 'AppModule');
    expect(undefinedImports).toEqual([]);
  });
});
