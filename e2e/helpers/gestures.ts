import type { Page } from "@playwright/test";

type RowRect = { left: number; top: number; width: number; height: number };

async function getWideRowRectFromAnchor(anchor: ReturnType<Page["getByText"]>, maxWalk: number): Promise<RowRect> {
  return anchor.evaluate((el, max) => {
    let n: HTMLElement | null = el as HTMLElement;
    for (let i = 0; i < max && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 260) {
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      n = n.parentElement;
    }
    const r = (el as HTMLElement).getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }, maxWalk);
}

/**
 * RNGH Swipeable + DraggableFlatList: mouse drags on web often never open the row (parent pan / pointer routing).
 * A synthetic touch sequence matches mobile and reliably reveals right actions.
 */
async function swipeLeftOnRowRect(page: Page, rowRect: RowRect): Promise<void> {
  const y = rowRect.top + rowRect.height / 2;
  const startX = rowRect.left + rowRect.width - 12;
  const endX = rowRect.left + 40;

  const usedTouch = await page.evaluate(
    ({ startX, endX, y }) => {
      const T = window.Touch;
      const TE = window.TouchEvent;
      if (typeof T !== "function" || typeof TE !== "function") {
        return false;
      }
      const steps = 28;
      const makeTouch = (x: number, el: Element) =>
        new T({
          identifier: 0,
          target: el,
          clientX: x,
          clientY: y,
          pageX: x,
          pageY: y,
          screenX: x,
          screenY: y,
          radiusX: 11,
          radiusY: 11,
          rotationAngle: 0,
          force: 1,
        });

      const startEl = document.elementFromPoint(startX, y);
      if (!startEl) return false;
      const t0 = makeTouch(startX, startEl);
      startEl.dispatchEvent(
        new TE("touchstart", {
          bubbles: true,
          cancelable: true,
          touches: [t0],
          targetTouches: [t0],
          changedTouches: [t0],
        }),
      );

      for (let i = 1; i <= steps; i++) {
        const x = startX + ((endX - startX) * i) / steps;
        const el = document.elementFromPoint(x, y) ?? startEl;
        const tm = makeTouch(x, el);
        el.dispatchEvent(
          new TE("touchmove", {
            bubbles: true,
            cancelable: true,
            touches: [tm],
            targetTouches: [tm],
            changedTouches: [tm],
          }),
        );
      }

      const endEl = document.elementFromPoint(endX, y) ?? startEl;
      const tEnd = makeTouch(endX, endEl);
      endEl.dispatchEvent(
        new TE("touchend", {
          bubbles: true,
          cancelable: true,
          touches: [],
          targetTouches: [],
          changedTouches: [tEnd],
        }),
      );
      return true;
    },
    { startX, endX, y },
  );

  if (!usedTouch) {
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.move(endX, y, { steps: 28 });
    await page.mouse.up();
  }
  await page.waitForTimeout(500);
}

/**
 * Reveals Swipeable right actions on web: horizontal drag left across the routine/todo row
 * (avoids scroll containers treating the gesture as vertical scroll).
 */
export async function swipeLeftToRevealRowActions(page: Page, rowText: string): Promise<void> {
  const anchor = page.getByText(rowText, { exact: true });
  await anchor.waitFor({ state: "visible" });
  await anchor.scrollIntoViewIfNeeded();

  const rowRect = await getWideRowRectFromAnchor(anchor, 12);
  await swipeLeftOnRowRect(page, rowRect);
}

/**
 * Workout routine row: swipe from the "Complete workout" control so pointer events
 * aren't intercepted by overlapping cards (title-only anchor can sit under the history card on web).
 */
export async function swipeLeftRevealWorkoutRoutineRow(page: Page): Promise<void> {
  const anchor = page.getByText("Complete workout", { exact: true }).first();
  await anchor.waitFor({ state: "visible" });
  await anchor.scrollIntoViewIfNeeded();

  const rowRect = await getWideRowRectFromAnchor(anchor, 15);
  await swipeLeftOnRowRect(page, rowRect);
}

/** RN Web: Delete label sits inside a Pressable; DOM click bypasses Playwright viewport checks. */
export async function clickSwipeDeleteAction(page: Page): Promise<void> {
  const deleteText = page.getByText("Delete", { exact: true }).first();
  await deleteText.waitFor({ state: "attached" });
  await deleteText.evaluate((el) => {
    const parent = (el as HTMLElement).parentElement;
    if (parent) {
      parent.click();
    } else {
      (el as HTMLElement).click();
    }
  });
}
