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

fn full_groups(memberships: u32, filter: u32) -> InteractionGroups {
    InteractionGroups::new(
        Group::from_bits_retain(memberships),
        Group::from_bits_retain(filter),
        InteractionTestMode::And,
    )
}

#[test]
fn high_standard_masks_preserve_and_or_and_custom_grouping_rules() {
    for mask in [
        1_u32 << 15,
        1 << 16,
        1 << 30,
        1 << 31,
        0xc001_8000,
        u32::MAX,
    ] {
        let other = mask.rotate_left(1);
        let a = full_groups(mask, other);
        let b = full_groups(other, mask);
        assert_eq!(a.memberships.bits(), mask);
        assert_eq!(b.filter.bits(), mask);
        assert!(a.test(b) && b.test(a));
        let blocked = full_groups(other, 0);
        assert!(!a.test(blocked) && !blocked.test(a));
        let or_a = InteractionGroups {
            test_mode: InteractionTestMode::Or,
            ..a
        };
        let or_b = InteractionGroups {
            test_mode: InteractionTestMode::Or,
            ..blocked
        };
        assert!(or_a.test(or_b) && or_b.test(or_a));
        assert!(!a.test(or_b) && !or_b.test(a)); // Mixed modes still require And.
        let custom_a = InteractionGroups {
            belongs_to_with_grouping: 1 << 31,
            collides_with_with_grouping: 1 << 30,
            belongs_to_grouping: 0x8000_0001,
            ..or_a
        };
        let custom_b = InteractionGroups {
            belongs_to_with_grouping: 1 << 30,
            collides_with_with_grouping: 0,
            belongs_to_grouping: 0x8000_0001,
            ..or_b
        };
        assert!(!custom_a.test(custom_b)); // Or cannot bypass the custom predicate.
        assert!(custom_a.test(InteractionGroups {
            belongs_to_grouping: 0x8000_0002,
            ..custom_b
        }));
    }
}

#[test]
fn high_standard_masks_rediscover_stationary_contacts_and_sensors() {
    for sensor in [false, true] {
        for mask in [
            1_u32 << 15,
            1 << 16,
            1 << 30,
            1 << 31,
            0xc001_8000,
            u32::MAX,
        ] {
            let other = mask.rotate_left(1);
            let a_groups = InteractionGroups {
                belongs_to_with_grouping: 1 << 31,
                collides_with_with_grouping: 1 << 30,
                belongs_to_grouping: 0x8000_0001,
                ..full_groups(mask, 0)
            };
            let b_groups = InteractionGroups {
                belongs_to_with_grouping: 1 << 30,
                collides_with_with_grouping: 1 << 31,
                belongs_to_grouping: 0x8000_0001,
                ..full_groups(other, mask)
            };
            let (mut world, a, b) = overlapping(sensor, a_groups, b_groups);
            let positions = (
                *world.colliders[a].position(),
                *world.colliders[b].position(),
            );
            world.step();
            assert!(!interacting(&world, a, b, sensor));
            let allowed = InteractionGroups {
                filter: Group::from_bits_retain(other),
                ..a_groups
            };
            world.colliders[a].set_collision_groups(allowed);
            world.step();
            assert!(
                interacting(&world, a, b, sensor),
                "mask {mask:#x} must rediscover stationary pairs"
            );
            world.colliders[a].set_collision_groups(a_groups);
            world.step();
            assert!(!interacting(&world, a, b, sensor));
            world.colliders[a].set_collision_groups(InteractionGroups {
                collides_with_with_grouping: 0,
                ..allowed
            });
            world.step();
            assert!(!interacting(&world, a, b, sensor));
            world.colliders[a].set_collision_groups(allowed);
            world.step();
            assert!(interacting(&world, a, b, sensor));
            world.colliders[a].set_collision_groups(InteractionGroups {
                collides_with_with_grouping: 0,
                ..allowed
            });
            world.step();
            assert!(!interacting(&world, a, b, sensor));
            world.colliders[a].set_collision_groups(InteractionGroups {
                collides_with_with_grouping: 0,
                belongs_to_grouping: 0x8000_0002,
                ..allowed
            });
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
    }
}

#[test]
fn high_solver_masks_control_impulses_without_changing_collision_groups() {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::ZERO;
    let collision_a = InteractionGroups {
        belongs_to_with_grouping: 1 << 30,
        collides_with_with_grouping: 1 << 16,
        belongs_to_grouping: 7,
        ..full_groups(1 << 15, 1 << 31)
    };
    let collision_b = InteractionGroups {
        belongs_to_with_grouping: 1 << 16,
        collides_with_with_grouping: 1 << 30,
        belongs_to_grouping: 7,
        ..full_groups(1 << 31, 1 << 15)
    };
    let a = world.insert_collider(
        ColliderBuilder::ball(1.0)
            .collision_groups(collision_a)
            .solver_groups(full_groups(1 << 30, 0)),
        None,
    );
    let body = world.insert_body(
        RigidBodyBuilder::dynamic()
            .can_sleep(false)
            .translation(Vector::X),
    );
    let b = world.insert_collider(
        ColliderBuilder::ball(1.0)
            .collision_groups(collision_b)
            .solver_groups(full_groups(1 << 16, 1 << 30)),
        Some(body),
    );
    world.step();
    assert!(interacting(&world, a, b, false));
    assert_eq!(world.bodies[body].translation(), Vector::X);
    assert!(
        world
            .narrow_phase
            .contact_pair(a, b)
            .unwrap()
            .manifolds()
            .iter()
            .all(|m| !m
                .data
                .solver_flags
                .contains(SolverFlags::COMPUTE_RIGID_IMPULSES))
    );
    world.colliders[a].set_solver_groups(full_groups(1 << 30, 1 << 16));
    world.step();
    assert!(
        world.bodies[body].translation().x > 1.0,
        "matching high solver masks must separate overlapping bodies"
    );
    assert_eq!(world.colliders[a].collision_groups(), collision_a);
    assert_eq!(world.colliders[b].collision_groups(), collision_b);
    world.colliders[a].set_collision_groups(InteractionGroups {
        collides_with_with_grouping: 0,
        ..collision_a
    });
    world.step();
    assert!(!interacting(&world, a, b, false));
}

#[test]
fn high_query_masks_use_both_full_width_sides_with_neutral_custom_fields() {
    for mask in [
        1_u32 << 15,
        1 << 16,
        1 << 30,
        1 << 31,
        0xc001_8000,
        u32::MAX,
    ] {
        let mut world = PhysicsWorld::new();
        let other = mask.rotate_left(1);
        let collider = world.insert_collider(
            ColliderBuilder::ball(1.0).collision_groups(InteractionGroups {
                belongs_to_with_grouping: 0,
                collides_with_with_grouping: 0,
                belongs_to_grouping: 7,
                ..full_groups(mask, other)
            }),
            None,
        );
        world.step();
        let ray = Ray::new(Vector::new(-3.0, 0.0, 0.0), Vector::X);
        let allowed = QueryFilter::default().groups(full_groups(other, mask));
        assert_eq!(
            world.cast_ray(&ray, 10.0, true, allowed).unwrap().0,
            collider
        );
        assert!(
            world
                .cast_ray(
                    &ray,
                    10.0,
                    true,
                    QueryFilter::default().groups(full_groups(other, 0))
                )
                .is_none()
        );
        assert!(
            world
                .cast_ray(
                    &ray,
                    10.0,
                    true,
                    QueryFilter::default().groups(full_groups(0, mask))
                )
                .is_none()
        );
    }
}
