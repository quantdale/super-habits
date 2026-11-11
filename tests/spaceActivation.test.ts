import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveControlNode,
  spaceActivationDecision,
  type SpaceActivationInput,
} from '@/core/ui/useSpaceActivation';

/**
 * CG-13 Space-activation contract (`docs/testing/known-gaps.md`).
 *
 * RN-Web's `PressResponder` accepts `Enter` for any role but `Space` only for
 * button-shaped targets, so `role="tab"` (segmented options) and `role="radio"`
 * (option rows) Pressables are inert on Space. `core/ui/useSpaceActivation.ts`
 * closes that gap with the same approach the repo already uses in
 * `features/habits/useHabitCheckboxKeyboard.ts` and `core/ui/Switch.tsx`.
 *
 * `spaceActivationDecision` is the pure decision table, `resolveControlNode` the
 * pure control lookup (the ref's own node, or the nearest role-bearing ancestor
 * for a primitive that hands out no ref), and the hook around them is pinned
 * here too so "preventDefault + stopPropagation + once per press" cannot
 * silently regress.
 */

function input(overrides: Partial<SpaceActivationInput> = {}): SpaceActivationInput {
  return { key: ' ', repeat: false, disabled: false, onOwnControl: true, ...overrides };
}

describe('spaceActivationDecision', () => {
  it('activates Space on the component’s own control', () => {
    expect(spaceActivationDecision(input())).toBe('activate');
    // Legacy browsers report the space bar as `Spacebar`.
    expect(spaceActivationDecision(input({ key: 'Spacebar' }))).toBe('activate');
  });

  it('ignores every other key, including Enter (RN-Web owns it)', () => {
    for (const key of ['Enter', 'ArrowLeft', 'ArrowRight', 'Escape', 'a', 'Tab', '']) {
      expect(spaceActivationDecision(input({ key }))).toBe('ignore');
    }
  });

  it('ignores Space that landed on another control (a nested button, a link)', () => {
    expect(spaceActivationDecision(input({ onOwnControl: false }))).toBe('ignore');
    expect(spaceActivationDecision(input({ onOwnControl: false, key: 'Spacebar' }))).toBe('ignore');
  });

  it('swallows Space on a disabled control without activating it', () => {
    expect(spaceActivationDecision(input({ disabled: true }))).toBe('swallow');
  });

  it('swallows auto-repeat while the key is held, so a press fires once', () => {
    expect(spaceActivationDecision(input({ repeat: true }))).toBe('swallow');
    expect(spaceActivationDecision(input({ repeat: true, disabled: true }))).toBe('swallow');
  });
});

/**
 * Hook behaviour. jsdom is not installed in this repo, so the DOM side runs
 * against a small fake node: a recording `addEventListener` /
 * `removeEventListener`, a `role` attribute, and a `closest()` that walks the
 * parent chain for the `[role="…"]` selector (the lookup `resolveControlNode`
 * performs).
 */
type FakeNode = {
  role: string | null;
  parentElement: FakeNode | null;
  children: FakeNode[];
  listeners: Map<string, (event: KeyboardEvent) => void>;
  getAttribute: (name: string) => string | null;
  closest: (selector: string) => FakeNode | null;
  addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => void;
  removeEventListener: (type: string, listener: (event: KeyboardEvent) => void) => void;
};

function fakeNode(role: string | null = null): FakeNode {
  const node: FakeNode = {
    role,
    parentElement: null,
    children: [],
    listeners: new Map(),
    getAttribute: (name) => (name === 'role' ? node.role : null),
    closest: (selector) => {
      const wanted = /^\[role="(.+)"\]$/.exec(selector)?.[1] ?? null;
      if (wanted === null) return null;
      let current: FakeNode | null = node;
      while (current) {
        if (current.role === wanted) return current;
        current = current.parentElement;
      }
      return null;
    },
    addEventListener: (type, listener) => {
      node.listeners.set(type, listener);
    },
    removeEventListener: (type, listener) => {
      if (node.listeners.get(type) === listener) node.listeners.delete(type);
    },
  };
  return node;
}

function append(parent: FakeNode, child: FakeNode): FakeNode {
  child.parentElement = parent;
  parent.children.push(child);
  return child;
}

describe('resolveControlNode', () => {
  it('uses the ref node itself when it carries the owned role', () => {
    const option = fakeNode('tab');
    expect(resolveControlNode(option, 'tab')).toBe(option);
  });

  it('finds the owning control from a node inside it (OptionRow)', () => {
    const control = fakeNode('radio');
    const labelBlock = append(control, fakeNode(null));
    expect(resolveControlNode(labelBlock, 'radio')).toBe(control);
  });

  it('is null when no ancestor owns that role', () => {
    expect(resolveControlNode(fakeNode(null), 'radio')).toBeNull();
    expect(resolveControlNode(fakeNode('button'), 'radio')).toBeNull();
  });
});

const platform = vi.hoisted(() => ({ os: 'web' }));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platform.os;
    },
    select: (obj: Record<string, unknown>) => obj[platform.os] ?? obj['default'],
  },
}));

const reactStubs = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
}));

vi.mock('react', () => {
  const hooks = {
    useRef: (init: unknown) => ({ current: init }),
    useEffect: (effect: () => unknown) => {
      reactStubs.effects.push(effect);
    },
  };
  return { ...hooks, default: hooks };
});

type Options = Parameters<(typeof import('@/core/ui/useSpaceActivation'))['useSpaceActivation']>[0];

/**
 * Run the hook outside a renderer: the unit project has no renderer, so the
 * component is modelled by attaching the node to the returned ref and then
 * running the recorded effect (React's real order).
 */
async function mount(options: Options, node: FakeNode) {
  vi.resetModules();
  reactStubs.effects.length = 0;
  const { useSpaceActivation } = await import('@/core/ui/useSpaceActivation');
  const mountHook = useSpaceActivation as (input: Options) => { current: FakeNode | null };
  const ref = mountHook(options);
  ref.current = node;
  const cleanups = reactStubs.effects.map((effect) => effect());
  return { cleanups };
}

function keyEvent(overrides: Record<string, unknown> = {}) {
  const event = {
    key: ' ',
    repeat: false,
    target: null as unknown,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault: () => {
      event.defaultPrevented = true;
    },
    stopPropagation: () => {
      event.propagationStopped = true;
    },
    ...overrides,
  };
  return event;
}

function fire(node: FakeNode, event: ReturnType<typeof keyEvent>) {
  const listener = node.listeners.get('keydown');
  if (!listener) throw new Error('no keydown listener bound');
  listener(event as unknown as KeyboardEvent);
  return event;
}

beforeEach(() => {
  platform.os = 'web';
  reactStubs.effects.length = 0;
});

describe('useSpaceActivation (web)', () => {
  it('activates once per press on keydown and swallows the default action', async () => {
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    await mount({ role: 'tab', onActivate }, node);

    const event = fire(node, keyEvent({ target: node }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented, 'Space must not scroll the page').toBe(true);
    expect(event.propagationStopped, 'an ancestor control must not also react').toBe(true);
  });

  it('does not activate on auto-repeat, but still prevents the scroll', async () => {
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    await mount({ role: 'tab', onActivate }, node);

    const event = fire(node, keyEvent({ target: node, repeat: true }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not activate a disabled control', async () => {
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    await mount({ role: 'tab', onActivate, disabled: true }, node);

    fire(node, keyEvent({ target: node }));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('ignores Enter, so RN-Web’s own Enter path is the only one firing', async () => {
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    await mount({ role: 'tab', onActivate }, node);

    const event = fire(node, keyEvent({ key: 'Enter', target: node }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    expect(event.propagationStopped).toBe(false);
  });

  it('binds on the owning control when the ref sits inside it (OptionRow)', async () => {
    const onActivate = vi.fn();
    const control = fakeNode('radio');
    const labelBlock = append(control, fakeNode(null));
    await mount({ role: 'radio', onActivate }, labelBlock);

    // The listener is on the row control, not the label block. Pressing it
    // once activates once; a second real press activates a second time.
    expect(labelBlock.listeners.size).toBe(0);
    fire(control, keyEvent({ target: control }));
    expect(onActivate).toHaveBeenCalledTimes(1);
    fire(control, keyEvent({ target: control }));
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('leaves a nested control with its own role to its own Space handling', async () => {
    const onActivate = vi.fn();
    const control = fakeNode('radio');
    const nestedButton = append(control, fakeNode('button'));
    await mount({ role: 'radio', onActivate }, control);

    const event = fire(control, keyEvent({ target: nestedButton }));
    expect(onActivate).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('binds nothing when no ancestor owns the role', async () => {
    const onActivate = vi.fn();
    const orphan = fakeNode(null);
    await mount({ role: 'radio', onActivate }, orphan);
    expect(orphan.listeners.size).toBe(0);
  });

  it('removes its listener on unmount', async () => {
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    const { cleanups } = await mount({ role: 'tab', onActivate }, node);
    expect(node.listeners.has('keydown')).toBe(true);

    for (const cleanup of cleanups) if (typeof cleanup === 'function') cleanup();
    expect(node.listeners.has('keydown')).toBe(false);
  });

  it('binds nothing off-web (native press handling is untouched)', async () => {
    platform.os = 'ios';
    const onActivate = vi.fn();
    const node = fakeNode('tab');
    await mount({ role: 'tab', onActivate }, node);

    expect(node.listeners.size).toBe(0);
  });
});
