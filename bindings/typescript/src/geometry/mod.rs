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
}
