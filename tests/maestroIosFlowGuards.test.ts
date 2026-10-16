import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression coverage for the three iOS flow defects classified from GitHub
 * run 36423379932 (source e9b42a3f31984f86dd50e0b337300df74898f422, artifact
 * 10980993163, 10/13, all three failures TEST_BUG). See
 * openspec/changes/final-certification-closure/ios-flow-classification.md.
 *
 *  - native-smoke asserted the long two-line "Classic sequence: focus -> ..."
 *    subtitle. The failure dump holds that string byte-identical at
 *    [20,119][382,160] with an on-screen ancestor chain and the failure
 *    screenshot shows it painted, yet Maestro still reported it not visible,
 *    while pomodoro-lifecycle passed against the same screen in the same run.
 *    The dump shows the discriminator: the subtitle and the "Pomodoro"
 *    heading are each exposed twice at identical bounds, while every element
 *    that matched successfully is exposed once.
 *  - workout-gym-v2-persistence reached the progression increment with a
 *    bounded repeat of right-margin swipes. All eight swipes reported
 *    COMPLETED and the flow still ended on the underlying Workout landing
 *    screen (only 'Weekly volume' / 'Workout history' in the failure tree).
 *    Its replacement scroll is an UNPROVEN hypothesis: the artifact shows the
 *    flow left the routine detail but not which gesture did it.
 *  - workout-gym-v2-session-lifecycle failed at hideKeyboard with "Couldn't
 *    hide the keyboard". The failure is scoped to the active workout
 *    session's custom numeric inputs: the tree has 12 hideKeyboard steps
 *    across 11 flows, of which 4 ran in run 36423379932 and all 4 passed.
 *
 * These guards keep the proven-failing constructs from returning. They do not
 * certify iOS: a passing 13/13 run at a new exact SHA is still required.
 */

const flowsDir = join(process.cwd(), '.maestro', 'flows');
// The flow files are checked in with CRLF endings; normalize so the
// multi-line assertions below are line-ending agnostic.
const read = (name: string) => readFileSync(join(flowsDir, name), 'utf8').replace(/\r\n/g, '\n');
const flowNames = readdirSync(flowsDir).filter((n) => n.endsWith('.yaml'));

describe('Maestro flows avoid constructs proven to fail on the iOS CI target', () => {
  // Scoped to the Gym V2 workout flows on purpose. hideKeyboard is not
  // universally unsupported: the tree has 12 steps across 11 flows, of which
  // 4 ran in run 36423379932 and all 4 passed. The other 7 were not in that
  // run. It fails specifically against the active workout session's custom
  // numeric inputs.
  it('no gym-v2 workout flow uses hideKeyboard, which those inputs cannot satisfy', () => {
    const offenders = flowNames
      .filter((n) => n.startsWith('workout-gym-v2-'))
      .filter((n) => /^\s*-\s*hideKeyboard\s*$/m.test(read(n)));
    expect(offenders).toEqual([]);
  });

  it('native-smoke asserts the Focus section on a single-occurrence element', () => {
    const flow = read('native-smoke.yaml');
    // 'Start focus' is exposed once on the failure screen and is the exact
    // element pomodoro-lifecycle matched and passed on in run 36423379932.
    expect(flow).toMatch(/visible:\s*'Start focus'/);
    // The wrapped subtitle is the element that was present, on screen, and
    // still reported not visible. Assert on selectors, not prose: the flow
    // comment records why it was removed.
    expect(flow).not.toMatch(/(visible|assertVisible):\s*'Classic sequence/);
  });

  it('native-smoke still walks all six sections', () => {
    const flow = read('native-smoke.yaml');
    for (const section of ['To Do', 'Habits', 'Focus', 'Workout', 'Calories', 'Today']) {
      expect(flow).toContain(`text: '${section}'`);
    }
  });

  it('gym-v2 persistence pulls the increment row inside the dialog panel before tapping', () => {
    const flow = read('workout-gym-v2-persistence.yaml');
    expect(flow).toContain(
      "- scrollUntilVisible:\n    element: 'Native custom press progression increment'",
    );
    // The escape-prone bounded repeat is gone; the element must not be the
    // `while: notVisible` target of a right-margin swipe budget.
    expect(flow).not.toMatch(
      /while:\s*\n\s*notVisible:\s*'Native custom press progression increment'/,
    );
    // The pull uses the flow's explicit side-margin crossing swipe, NOT
    // centerElement. Two evidence layers: (1) the tap escape itself — at the
    // row's clipped position ([41,812][141,843] against the dialog panel's
    // bottom edge ~813, core/ui/Modal dialog maxHeight 86% centered on the
    // 874pt target) the bounds-center tap lands on the modal's Dismiss scrim
    // and closes the routine (runs 38726951043 and 38676461813); (2)
    // centerElement cannot be the positioning fix — run 38793221651 proved
    // Maestro 2.2.0's centering does not converge on this target (the row
    // was found fully visible — Visibility Percent 1.0 — yet the centering
    // swipes overshot it until the 20s budget expired in hierarchy fetches).
    const incrementBlock = flow
      .slice(
        flow.indexOf(
          "- scrollUntilVisible:\n    element: 'Native custom press progression increment'",
        ),
      )
      .split('\n- ')[0];
    expect(incrementBlock).not.toMatch(/centerElement/);
    // The crossing swipe must immediately precede the row's scroll so the
    // row sits inside the panel before any bounds-center tap.
    expect(flow).toMatch(
      /- swipe:\s*\n\s*start: '85%, 72%'\s*\n\s*end: '85%, 25%'[\s\S]{0,120}- scrollUntilVisible:\s*\n\s*element: 'Native custom press progression increment'/,
    );
  });

  it('no workout row scroll pairs centerElement with direction UP', () => {
    // Maestro 2.2.0's centering with direction UP does not converge on the
    // iOS CI target (run 38793221651: all three UP+center row scrolls failed
    // while every DOWN+center scroll passed). The plain visibility stop is
    // the proven construct for those rows.
    for (const name of flowNames.filter((n) => n.startsWith('workout-'))) {
      const flow = read(name);
      const blocks = flow.split(/\n- /);
      for (const block of blocks) {
        if (/scrollUntilVisible:/.test(block) && /direction: UP/.test(block)) {
          expect(block, `${name} pairs centerElement with a direction UP scroll`).not.toMatch(
            /centerElement/,
          );
        }
      }
    }
  });

  it('gym-v2 persistence taps stepper inputs by index and asserts unique values', () => {
    const flow = read('workout-gym-v2-persistence.yaml');
    // NumberStepperField exposes its label Text and the input under the same
    // name; index 0 is the inert label and inputText after a label tap is a
    // silent no-op (proven for the old `Weight` tap in run 36423379932), so
    // the input is index 1 — the same convention as the lifecycle flow.
    expect(flow).toMatch(/tapOn:\s*\n\s*text: 'Target reps min'\s*\n\s*index: 1/);
    expect(flow).toMatch(/tapOn:\s*\n\s*text: 'Target reps max'\s*\n\s*index: 1/);
    // The post-restart persistence oracles must each be satisfiable only by
    // their own field (full-match text semantics): bare '40' is the set's
    // default Active-seconds value and would pass even if Target load never
    // persisted, and 5/8 must not double as the Target reps values.
    expect(flow).not.toMatch(/assertVisible: '40'/);
    for (const value of ['2.5', '5', '8', '7', '11', '42']) {
      expect(flow).toContain(`assertVisible: '${value}'`);
    }
  });

  it('gym-v2 lifecycle dismisses the keyboard with enter-to-blur, not hideKeyboard', () => {
    const flow = read('workout-gym-v2-session-lifecycle.yaml');
    expect(flow).not.toMatch(/^\s*-\s*hideKeyboard\s*$/m);
    expect(flow).toMatch(
      /inputText:\s*'42'[\s\S]*?assertVisible:\s*'42'[\s\S]*?-\s*pressKey:\s*enter/,
    );
  });

  it('gym-v2 lifecycle keeps the post-restart weight-survival assertion', () => {
    const flow = read('workout-gym-v2-session-lifecycle.yaml');
    const tail = flow.slice(flow.indexOf('- killApp'));
    expect(tail).toMatch(/-\s*killApp/);
    expect(tail).toMatch(/-\s*launchApp/);
    expect(tail).toMatch(/assertVisible:\s*'42'/);
    expect(tail).toMatch(/assertVisible:\s*'6'/);
  });

  it('every takeScreenshot breadcrumb is gitignored at the repo root', () => {
    // Maestro writes `takeScreenshot: <bare-name>` into the process CWD (the
    // repo root). Unignored, those PNGs fail BOTH the iOS lane's
    // sourceUnchangedApartFromGeneratedIos gate and the Android runner's
    // checkTarget: runs 38676461813 and 38726951043 ended sourceUnchanged=false
    // for exactly this reason. Keep every breadcrumb name ignored.
    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
    const names = flowNames.flatMap((name) =>
      [...read(name).matchAll(/^- takeScreenshot:\s*(\S+)\s*$/gm)].map((match) => match[1]),
    );
    expect(names.length, 'no takeScreenshot breadcrumbs found to guard').toBeGreaterThan(0);
    for (const name of names) {
      expect(gitignore, `takeScreenshot '${name}' is not gitignored`).toContain(`/${name}.png`);
    }
  });
});
