//! Structures related to geometry: colliders, shapes, etc.

pub use self::broad_phase::*;
pub use self::collider_set::*;
pub use self::contact::*;
pub use self::feature::*;
pub use self::narrow_phase::*;
pub use self::point::*;
pub use self::ray::*;
pub use self::shape::*;
pub use self::toi::*;

mod broad_phase;
mod collider;
mod collider_set;
mod contact;
mod feature;
mod narrow_phase;
mod point;
mod ray;
mod shape;
mod toi;

use rapier::dynamics::CoefficientCombineRule;
use rapier::geometry::{InteractionGroups, InteractionTestMode};
use rapier::prelude::Group;

pub const fn unpack_interaction_groups(memberships_filter: u32) -> InteractionGroups {
    InteractionGroups::new(
        Group::from_bits_retain((memberships_filter >> 16) as u32),
        Group::from_bits_retain((memberships_filter & 0x0000_ffff) as u32),
        InteractionTestMode::And,
    )
}

pub const fn pack_interaction_groups(groups: InteractionGroups) -> u32 {
    (groups.memberships.bits() << 16) | groups.filter.bits()
}

/// Separate full-width masks. The legacy packed conversion remains unchanged.
pub const fn unpack_interaction_groups32(memberships: u32, filter: u32) -> InteractionGroups {
    InteractionGroups::new(
        Group::from_bits_retain(memberships),
        Group::from_bits_retain(filter),
        InteractionTestMode::And,
    )
}

pub const fn unpack_detailed_interaction_groups32(
    memberships: u32,
    filter: u32,
    belongs_to_with_grouping: u32,
    collides_with_with_grouping: u32,
    belongs_to_grouping: u32,
) -> InteractionGroups {
    InteractionGroups {
        belongs_to_with_grouping,
        collides_with_with_grouping,
        belongs_to_grouping,
        ..unpack_interaction_groups32(memberships, filter)
    }
}

// Optional trailing masks extend raw queries without changing packed callers.
// A supplied full-width side defaults the other side to ALL, never to 16 bits.
pub fn unpack_query_groups(
    packed: Option<u32>,
    memberships: Option<u32>,
    filter: Option<u32>,
) -> Option<InteractionGroups> {
    if memberships.is_some() || filter.is_some() {
        Some(unpack_interaction_groups32(
            memberships.unwrap_or(u32::MAX),
            filter.unwrap_or(u32::MAX),
        ))
    } else {
        packed.map(unpack_interaction_groups)
    }
}

/// Adds the fork's same-group filtering to the standard, neutral unpacking path.
pub const fn unpack_detailed_interaction_groups(
    memberships_filter: u32,
    belongs_to_with_grouping: u32,
    collides_with_with_grouping: u32,
    belongs_to_grouping: u32,
) -> InteractionGroups {
    InteractionGroups {
        belongs_to_with_grouping,
        collides_with_with_grouping,
        belongs_to_grouping,
        ..unpack_interaction_groups(memberships_filter)
    }
}

pub const fn combine_rule_from_u32(rule: u32) -> CoefficientCombineRule {
    if rule == CoefficientCombineRule::Average as u32 {
        CoefficientCombineRule::Average
    } else if rule == CoefficientCombineRule::Min as u32 {
        CoefficientCombineRule::Min
    } else if rule == CoefficientCombineRule::Multiply as u32 {
        CoefficientCombineRule::Multiply
    } else {
        CoefficientCombineRule::Max
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simple_groups_remain_neutral_for_queries_and_solver_groups() {
        let groups = unpack_interaction_groups(0x0002_0001);
        assert_eq!(groups.memberships, Group::GROUP_2);
        assert_eq!(groups.filter, Group::GROUP_1);
        assert_eq!(groups.test_mode, InteractionTestMode::And);
        assert_eq!(groups.belongs_to_with_grouping, u32::MAX);
        assert_eq!(groups.collides_with_with_grouping, u32::MAX);
        assert_eq!(groups.belongs_to_grouping, u32::MAX);
        assert_eq!(pack_interaction_groups(groups), 0x0002_0001);
    }

    #[test]
    fn detailed_groups_keep_standard_bits_and_full_width_custom_values() {
        let groups = unpack_detailed_interaction_groups(0x0002_0001, 1 << 31, 1 << 30, 17);
        assert_eq!(pack_interaction_groups(groups), 0x0002_0001);
        assert_eq!(groups.test_mode, InteractionTestMode::And);
        assert_eq!(groups.belongs_to_with_grouping, 1 << 31);
        assert_eq!(groups.collides_with_with_grouping, 1 << 30);
        assert_eq!(groups.belongs_to_grouping, 17);
    }

    #[test]
    fn full_width_groups_and_queries_do_not_alias_high_bits() {
        for mask in [1 << 15, 1 << 16, 1 << 30, 1 << 31, 0xc001_8000, u32::MAX] {
            let groups = unpack_interaction_groups32(mask, mask);
            assert_eq!(groups.memberships.bits(), mask);
            assert_eq!(groups.filter.bits(), mask);
            assert_eq!(groups.test_mode, InteractionTestMode::And);
            assert_eq!(groups.belongs_to_with_grouping, u32::MAX);
            assert_eq!(
                unpack_query_groups(None, Some(mask), Some(mask)),
                Some(groups)
            );
            assert_eq!(
                unpack_query_groups(Some(0), Some(mask), Some(mask)),
                Some(groups)
            );
        }
        assert_eq!(unpack_query_groups(None, None, None), None);
        assert_eq!(
            unpack_query_groups(Some(0x0002_0001), None, None),
            Some(unpack_interaction_groups(0x0002_0001))
        );
        assert_eq!(
            unpack_query_groups(None, Some(1 << 31), None)
                .unwrap()
                .filter,
            Group::ALL
        );
    }

    #[test]
    fn raw_full_width_setters_getters_and_legacy_reset_reach_native_colliders() {
        let mut set = RawColliderSet(rapier::geometry::ColliderSet::new());
        let handle = set
            .0
            .insert(rapier::geometry::ColliderBuilder::ball(1.0).build());
        let flat = crate::utils::flat_handle(handle.0);
        for mask in [
            1_u32 << 15,
            1 << 16,
            1 << 30,
            1 << 31,
            0xc001_8000,
            u32::MAX,
        ] {
            let filter = mask.rotate_left(1);
            set.coSetDetailedCollisionGroups32(flat, mask, filter, 1 << 31, 1 << 30, 0x8000_0001);
            assert_eq!(set.coCollisionMemberships(flat), mask);
            assert_eq!(set.coCollisionFilter(flat), filter);
            assert_eq!(set.coBelongsToWithGrouping(flat), 1 << 31);
            assert_eq!(set.coCollidesWithWithGrouping(flat), 1 << 30);
            assert_eq!(set.coBelongsToGrouping(flat), 0x8000_0001);
            let collision = set.0[handle].collision_groups();
            set.coSetSolverGroups32(flat, filter, mask);
            assert_eq!(set.coSolverMemberships(flat), filter);
            assert_eq!(set.coSolverFilter(flat), mask);
            assert_eq!(set.0[handle].collision_groups(), collision);
        }
        set.coSetCollisionGroups32(flat, 1 << 31, 1 << 16);
        assert_eq!(set.coBelongsToWithGrouping(flat), u32::MAX);
        assert_eq!(set.coCollidesWithWithGrouping(flat), u32::MAX);
        assert_eq!(set.coBelongsToGrouping(flat), u32::MAX);
        set.coSetCollisionGroups(flat, 0x0002_0001);
        set.coSetSolverGroups(flat, 0x0001_0002);
        assert_eq!(set.coCollisionGroups(flat), 0x0002_0001);
        assert_eq!(set.coCollisionMemberships(flat), 2);
        assert_eq!(set.coCollisionFilter(flat), 1);
        assert_eq!(set.coSolverGroups(flat), 0x0001_0002);
    }
}
