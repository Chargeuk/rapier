//! Chargeuk grouping semantics and stationary pair rediscovery through the real pipeline.
use rapier3d::prelude::*;
use std::sync::atomic::{AtomicUsize, Ordering};

fn detailed(membership: u32, filter: u32, grouping: u32) -> InteractionGroups {
    InteractionGroups {
        belongs_to_with_grouping: membership,
        collides_with_with_grouping: filter,
        belongs_to_grouping: grouping,
        ..InteractionGroups::all()
    }
}

#[test]
fn standard_modes_and_neutral_defaults() {
    let and = InteractionGroups::new(Group::GROUP_1, Group::GROUP_2, InteractionTestMode::And);
    let or = InteractionGroups::new(Group::GROUP_2, Group::NONE, InteractionTestMode::Or);
    assert!(!and.test(or));
    assert!(!or.test(and)); // And wins mixed modes.
    let a = InteractionGroups {
        test_mode: InteractionTestMode::Or,
        ..and
    };
    assert!(a.test(or));
    assert!(or.test(a));
    assert_eq!(and.belongs_to_with_grouping, u32::MAX);
    assert_eq!(and.collides_with_with_grouping, u32::MAX);
    assert_eq!(and.belongs_to_grouping, u32::MAX);
    assert!(InteractionGroups::all().test(InteractionGroups::default()));
    assert!(!InteractionGroups::none().test(InteractionGroups::all()));
}

#[test]
fn custom_masks_are_bilateral_only_within_a_grouping() {
    let a = detailed(1, 2, 7);
    let b = detailed(2, 1, 7);
    assert!(a.test(b) && b.test(a));
    for blocked in [detailed(2, 0, 7), detailed(4, 1, 7)] {
        assert!(!a.test(blocked));
        assert!(!blocked.test(a));
    }
    assert!(a.test(detailed(0, 0, 8))); // Different IDs bypass only custom masks.
    let excluded = InteractionGroups {
        filter: Group::NONE,
        ..detailed(0, 0, 8)
    };
    assert!(!a.test(excluded));
    let or_a = InteractionGroups {
        test_mode: InteractionTestMode::Or,
        ..a
    };
    let or_b = InteractionGroups {
        test_mode: InteractionTestMode::Or,
        ..detailed(2, 0, 7)
    };
    assert!(!or_a.test(or_b)); // Or cannot bypass a failed custom mask.
}

fn overlapping(
    sensor: bool,
    a: InteractionGroups,
    b: InteractionGroups,
) -> (PhysicsWorld, ColliderHandle, ColliderHandle) {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::ZERO;
    // Fixed, overlapping colliders stay still even when contacts are allowed.
    let first = world.insert_collider(
        ColliderBuilder::ball(1.0)
            .active_collision_types(ActiveCollisionTypes::all())
            .sensor(sensor)
            .collision_groups(a),
        None,
    );
    let second = world.insert_collider(
        ColliderBuilder::ball(1.0)
            .translation(Vector::new(1.0, 0.0, 0.0))
            .active_collision_types(ActiveCollisionTypes::all())
            .collision_groups(b),
        None,
    );
    (world, first, second)
}

fn interacting(world: &PhysicsWorld, a: ColliderHandle, b: ColliderHandle, sensor: bool) -> bool {
    if sensor {
        world.narrow_phase.intersection_pair(a, b) == Some(true)
    } else {
        world
            .narrow_phase
            .contact_pair(a, b)
            .is_some_and(|p| p.has_any_active_contact())
    }
}

fn rediscovery(sensor: bool) {
    let (mut world, a, b) = overlapping(sensor, detailed(1, 0, 7), detailed(2, 1, 7));
    let positions = (
        *world.colliders[a].position(),
        *world.colliders[b].position(),
    );
    world.step();
    assert!(!interacting(&world, a, b, sensor));
    world.colliders[a].set_collision_groups(detailed(1, 2, 7));
    world.step();
    assert!(
        interacting(&world, a, b, sensor),
        "stationary pair must be rediscovered"
    );
    world.colliders[a].set_collision_groups(detailed(1, 0, 7));
    world.step();
    assert!(
        !interacting(&world, a, b, sensor),
        "existing pair must be invalidated"
    );
    world.colliders[a].set_collision_groups(detailed(0, 0, 8));
    world.step();
    assert!(
        interacting(&world, a, b, sensor),
        "changed grouping ID must rediscover pair"
    );
    world.colliders[a].set_collision_groups(InteractionGroups::none());
    world.step();
    assert!(!interacting(&world, a, b, sensor));
    world.colliders[a].set_collision_groups(InteractionGroups::all());
    world.step();
    assert!(interacting(&world, a, b, sensor));
    assert_eq!(
        positions,
        (
            *world.colliders[a].position(),
            *world.colliders[b].position()
        )
    );
}

#[test]
fn stationary_contact_pairs_rediscover_after_group_changes() {
    rediscovery(false);
}

#[test]
fn stationary_sensor_pairs_rediscover_after_group_changes() {
    rediscovery(true);
}

#[test]
fn solver_filtering_keeps_contacts_and_custom_collision_masks() {
    let groups = detailed(1, 2, 7);
    let (mut world, a, b) = overlapping(false, groups, detailed(2, 1, 7));
    world.colliders[a].set_solver_groups(InteractionGroups::none());
    world.step();
    assert!(interacting(&world, a, b, false));
    let pair = world.narrow_phase.contact_pair(a, b).unwrap();
    assert!(!pair.manifolds().is_empty());
    assert!(pair.manifolds().iter().all(|m| {
        !m.data
            .solver_flags
            .contains(SolverFlags::COMPUTE_RIGID_IMPULSES)
    }));
    assert_eq!(world.colliders[a].collision_groups(), groups);
    world.colliders[a].set_solver_groups(InteractionGroups::all());
    world.step();
    assert!(interacting(&world, a, b, false));
    world.colliders[a].set_collision_groups(detailed(1, 0, 7));
    world.step();
    assert!(!interacting(&world, a, b, false));
}

struct RejectPairs(AtomicUsize);
impl PhysicsHooks for RejectPairs {
    fn filter_contact_pair(&self, _: &PairFilterContext) -> Option<SolverFlags> {
        self.0.fetch_add(1, Ordering::Relaxed);
        None
    }
    fn filter_intersection_pair(&self, _: &PairFilterContext) -> bool {
        self.0.fetch_add(1, Ordering::Relaxed);
        false
    }
}

#[test]
fn hooks_remain_opt_in_and_custom_filters_cannot_be_bypassed() {
    for sensor in [false, true] {
        let (mut inactive_world, inactive_a, inactive_b) =
            overlapping(sensor, detailed(1, 2, 7), detailed(2, 1, 7));
        let inactive_hooks = RejectPairs(AtomicUsize::new(0));
        inactive_world.step_with_events(&inactive_hooks, &());
        assert!(interacting(&inactive_world, inactive_a, inactive_b, sensor));
        assert_eq!(inactive_hooks.0.load(Ordering::Relaxed), 0);

        let (mut world, a, b) = overlapping(sensor, detailed(1, 2, 7), detailed(2, 1, 7));
        let hooks = RejectPairs(AtomicUsize::new(0));
        // Opt in before the first step: upstream set_active_hooks does not dirty
        // existing stationary pairs, and runtime hook-toggle invalidation is unrelated.
        world.colliders[a].set_active_hooks(if sensor {
            ActiveHooks::FILTER_INTERSECTION_PAIR
        } else {
            ActiveHooks::FILTER_CONTACT_PAIRS
        });
        world.step_with_events(&hooks, &());
        assert!(!interacting(&world, a, b, sensor));
        let count = hooks.0.load(Ordering::Relaxed);
        assert!(count > 0);
        world.colliders[a].set_collision_groups(detailed(1, 0, 7));
        world.step_with_events(&hooks, &());
        assert!(!interacting(&world, a, b, sensor));
        assert_eq!(hooks.0.load(Ordering::Relaxed), count);
        world.colliders[a].set_collision_groups(detailed(1, 2, 7));
        world.step_with_events(&hooks, &());
        assert!(!interacting(&world, a, b, sensor));
        assert!(hooks.0.load(Ordering::Relaxed) > count);
    }
}
