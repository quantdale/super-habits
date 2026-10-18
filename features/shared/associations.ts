/**
 * Authoritative Project/Goal association contract (`AUD-SH12-A`/`B`).
 *
 * ## The audited defects
 *
 * Creation and update enforced DIFFERENT subsets of the documented contract:
 *
 *  - `addTodo` wrote the requested ids verbatim, so a Goal in Project P
 *    persisted `project_id = null` (no alignment) and a dangling id was
 *    accepted;
 *  - `addGoal` accepted a `projectId` that did not exist;
 *  - moving a Todo's Project kept a Goal from the old Project (an inconsistent
 *    pair: `project_id` P2 with a Goal that pins P);
 *  - clearing a linked Habit's Project kept a Project-backed Goal.
 *
 * ## The contract, in one place
 *
 * 1. A non-null `projectId`/`goalId` MUST reference an active (non-deleted)
 *    parent; otherwise the mutation is refused atomically.
 * 2. A Project-backed Goal aligns the child's Project to the Goal's Project.
 * 3. A project-only reassignment that conflicts with an existing Project-backed
 *    Goal clears that Goal (matching the established Todo clear semantics) —
 *    otherwise the pair is self-contradictory.
 * 4. A Goal selection explicitly supplied in the same mutation is authoritative
 *    and aligns the Project (rule 2 wins over rule 3).
 * 5. A Goal WITHOUT a Project imposes no Project, so an independent valid
 *    Project is preserved.
 *
 * This module is pure: it reads parents through a caller-supplied query function
 * so it runs inside the mutation's own transaction (no second connection, no
 * read outside the unit of work).
 */

/** The association fields a caller may set on a child row. */
export type AssociationInput = { projectId?: string | null; goalId?: string | null };

/** The child row's current association pair. */
export type AssociationState = { project_id: string | null; goal_id: string | null };

/** The resolved pair to persist. */
export type AssociationResolution = {
  nextProjectId: string | null;
  nextGoalId: string | null;
};

/**
 * Read a parent row by id, or `null` when it is absent or soft-deleted.
 *
 * Callers pass a function bound to their open transaction so the read and the
 * write share one unit of work.
 */
export type AssociationLookup = {
  /** The Project's `project_id`, or `undefined` when the parent does not exist. */
  projectExists: (id: string) => Promise<boolean>;
  /** The Goal's `project_id`, or `undefined` when the parent does not exist. */
  goalProjectId: (id: string) => Promise<string | null | undefined>;
};

/**
 * Resolve the next `(project_id, goal_id)` pair for a child row.
 *
 * Applied identically by every create, update, bulk, command and assignment
 * entrypoint, so no path can enforce a different subset.
 *
 * @param current the child's current pair (both `null` for a creation)
 * @param association the requested changes (`undefined` = leave unchanged)
 * @param lookup in-transaction parent lookups
 */
export async function resolveProjectGoalAssociation(
  current: AssociationState,
  association: AssociationInput,
  lookup: AssociationLookup,
): Promise<AssociationResolution> {
  let nextProjectId = current.project_id;
  let nextGoalId = current.goal_id;

  // Rule 1 (project half): a non-null parent must exist and be active.
  if (association.projectId !== undefined) {
    if (association.projectId !== null && !(await lookup.projectExists(association.projectId))) {
      throw new Error('Project not found.');
    }
    nextProjectId = association.projectId;
  }

  if (association.goalId !== undefined) {
    // Rule 1 (goal half) + rule 2 + rule 4: the explicit Goal wins and aligns.
    if (association.goalId !== null) {
      const goalProjectId = await lookup.goalProjectId(association.goalId);
      if (goalProjectId === undefined) throw new Error('Goal not found.');
      nextGoalId = association.goalId;
      // Rule 2 / rule 5: only a Project-backed Goal imposes its Project.
      if (goalProjectId !== null) nextProjectId = goalProjectId;
    } else {
      nextGoalId = null;
    }
    return { nextProjectId, nextGoalId };
  }

  // Rule 3: a project-only change must not leave a Goal that contradicts it.
  if (nextGoalId !== null) {
    const goalProjectId = await lookup.goalProjectId(nextGoalId);
    // A tombstoned or missing Goal no longer imposes anything, but it must not
    // linger as a dangling reference either.
    if (goalProjectId === undefined) {
      nextGoalId = null;
    } else if (
      association.projectId !== undefined &&
      goalProjectId !== null &&
      goalProjectId !== nextProjectId
    ) {
      nextGoalId = null;
    }
  }

  return { nextProjectId, nextGoalId };
}
