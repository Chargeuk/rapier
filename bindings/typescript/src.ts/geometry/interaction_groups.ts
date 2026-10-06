/**
 * Pairwise filtering using bit masks.
 *
 * This filtering method is based on two 16-bit values:
 * - The interaction groups (the 16 left-most bits of `self.0`).
 * - The interaction mask (the 16 right-most bits of `self.0`).
 *
 * An interaction is allowed between two filters `a` and `b` two conditions
 * are met simultaneously:
 * - The interaction groups of `a` has at least one bit set to `1` in common with the interaction mask of `b`.
 * - The interaction groups of `b` has at least one bit set to `1` in common with the interaction mask of `a`.
 * In other words, interactions are allowed between two filter iff. the following condition is met:
 *
 * ```
 * ((a >> 16) & b) != 0 && ((b >> 16) & a) != 0
 * ```
 */
export type InteractionGroups = number;

/** Separate unsigned 32-bit masks; never pack these into a JavaScript number. */
export interface InteractionGroups32 {
    memberships: number;
    filter: number;
}

/** Queries accept the legacy packed value or explicit full-width masks. */
export type QueryInteractionGroups = InteractionGroups | InteractionGroups32;

/** @internal Translate query masks without truncating either full-width side. */
export function intoRawQueryGroups(
    groups?: QueryInteractionGroups,
): [number | undefined, number | undefined, number | undefined] {
    if (typeof groups === "number") return [groups, undefined, undefined];
    if (groups == null) return [undefined, undefined, undefined];
    return [undefined, groups.memberships >>> 0, groups.filter >>> 0];
}
