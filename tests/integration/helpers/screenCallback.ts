import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

/**
 * Extract a React screen's own callback body and run it against REAL data
 * functions with the UI/native boundaries stubbed.
 *
 * Why: several screen behaviours (draft persistence, resume replay, recovery
 * writes) are `useCallback` closures whose correctness is a data-layer fact.
 * Calling a hand-written copy would test the copy, and a source-string assertion
 * only pins text. Compiling the declared closure means a regression in the
 * screen itself fails the test, with SQLite still real.
 */
export function screenCallback(
  name: string,
  dependencies: Record<string, unknown>,
  screen = 'WorkoutScreen',
) {
  const filename = path.resolve(__dirname, `../../../features/workout/${screen}.tsx`);
  const source = ts.createSourceFile(
    filename,
    readFileSync(filename, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer) {
      callback = ts.isCallExpression(node.initializer)
        ? node.initializer.arguments[0].getText(source)
        : node.initializer.getText(source);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!callback) throw new Error(`Missing screen callback ${name}`);
  const compiled = ts.transpileModule(
    `const callback = ${callback}; exports.callback = callback;`,
    {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    },
  ).outputText;
  const exports: { callback?: (...args: unknown[]) => Promise<void> | void } = {};
  runInNewContext(compiled, { exports, Error, ...dependencies });
  return exports.callback!;
}
