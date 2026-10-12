//! The broad phase no longer creates pairs that the narrow phase's
//! `ActiveCollisionTypes` filter would drop every frame (e.g. fixed-vs-fixed):
//! big static environments would otherwise flood the contact graph with
//! millions of dead edges. These tests pin the filtering itself and the
//! re-discovery paths for colliders whose filter inputs change afterwards.

#![cfg(feature = "dim3")]

use rapier3d::prelude::*;

fn overlapping_world() -> (PhysicsWorld, ColliderHandle, ColliderHandle) {
    // Two overlapping parentless (thus fixed) colliders.
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::new(0.0, -9.81, 0.0);
    let c1 = world.insert_collider(ColliderBuilder::cuboid(1.0, 1.0, 1.0), None);
    let c2 = world.insert_collider(
        ColliderBuilder::cuboid(1.0, 1.0, 1.0).translation(Vector::new(0.5, 0.5, 0.0)),
        None,
    );
    (world, c1, c2)
}

#[test]
fn no_fixed_fixed_pairs() {
    let (mut world, _, _) = overlapping_world();
    for _ in 0..3 {
        world.step();
    }
    assert_eq!(world.narrow_phase.contact_pairs().count(), 0);
}

#[test]
fn fixed_fixed_pair_kept_when_opted_in() {
    // A collider opting into FIXED_FIXED collision types keeps its pairs.
    let mut world = PhysicsWorld::new();
    let _ = world.insert_collider(
        ColliderBuilder::cuboid(1.0, 1.0, 1.0).active_collision_types(ActiveCollisionTypes::all()),
        None,
    );
    let _ = world.insert_collider(
        ColliderBuilder::cuboid(1.0, 1.0, 1.0).translation(Vector::new(0.5, 0.5, 0.0)),
        None,
    );
    for _ in 0..3 {
        world.step();
    }
    assert_eq!(world.narrow_phase.contact_pairs().count(), 1);
}

/// A body whose type changes from fixed to dynamic must re-discover the pairs
/// that were suppressed while it was fixed.
#[test]
fn body_type_change_rediscovers_pairs() {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::new(0.0, -9.81, 0.0);

    // Static ground, and a FIXED body resting slightly above it (AABBs overlap).
    let _ground = world.insert_collider(ColliderBuilder::cuboid(5.0, 0.5, 5.0), None);
    let (body, _) = world.insert(
        RigidBodyBuilder::fixed().translation(Vector::new(0.0, 1.01, 0.0)),
        ColliderBuilder::cuboid(0.5, 0.5, 0.5),
    );

    for _ in 0..3 {
        world.step();
    }
    // Fixed vs fixed: no pair.
    assert_eq!(world.narrow_phase.contact_pairs().count(), 0);

    world
        .bodies
        .get_mut(body)
        .unwrap()
        .set_body_type(RigidBodyType::Dynamic, true);

    for _ in 0..10 {
        world.step();
    }
    assert_eq!(
        world.narrow_phase.contact_pairs().count(),
        1,
        "pair not re-discovered after fixed -> dynamic switch"
    );

    // And the contact must actually resolve: the box stays on the ground.
    for _ in 0..100 {
        world.step();
    }
    let y = world.bodies.get(body).unwrap().translation().y;
    assert!(
        (y - 1.0).abs() < 0.05,
        "box did not rest on the ground: y = {y}"
    );
}

/// A parentless collider attached to a dynamic body afterwards must re-discover
/// its suppressed pairs.
#[test]
fn set_parent_rediscovers_pairs() {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::new(0.0, -9.81, 0.0);

    let _ground = world.insert_collider(ColliderBuilder::cuboid(5.0, 0.5, 5.0), None);
    let orphan = world.insert_collider(
        ColliderBuilder::cuboid(0.5, 0.5, 0.5).translation(Vector::new(0.0, 1.01, 0.0)),
        None,
    );

    for _ in 0..3 {
        world.step();
    }
    assert_eq!(world.narrow_phase.contact_pairs().count(), 0);

    let body = world
        .bodies
        .insert(RigidBodyBuilder::dynamic().translation(Vector::new(0.0, 1.01, 0.0)));
    let bodies = &mut world.bodies;
    world.colliders.set_parent(orphan, Some(body), bodies);

    for _ in 0..10 {
        world.step();
    }
    assert_eq!(
        world.narrow_phase.contact_pairs().count(),
        1,
        "pair not re-discovered after attaching the collider to a dynamic body"
    );
}

/// Suppressed same-parent pairs must become contacts after stationary reparenting,
/// and disappear from the narrow phase if made same-parent again.
#[test]
fn same_parent_pairs_rediscover_after_reparenting() {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::ZERO;
    let first_body = world.bodies.insert(RigidBodyBuilder::fixed());
    let second_body = world.bodies.insert(RigidBodyBuilder::fixed());
    let a = world.insert_collider(
        ColliderBuilder::ball(1.0).active_collision_types(ActiveCollisionTypes::all()),
        Some(first_body),
    );
    let b = world.insert_collider(
        ColliderBuilder::ball(1.0).active_collision_types(ActiveCollisionTypes::all()),
        Some(first_body),
    );
    world.step();
    assert_eq!(world.narrow_phase.contact_pairs().count(), 0);
    let positions = (
        *world.colliders[a].position(),
        *world.colliders[b].position(),
    );
    world
        .colliders
        .set_parent(b, Some(second_body), &mut world.bodies);
    world.step();
    assert!(world
        .narrow_phase
        .contact_pair(a, b)
        .unwrap()
        .has_any_active_contact());
    world
        .colliders
        .set_parent(b, Some(first_body), &mut world.bodies);
    world.step();
    assert!(world
        .narrow_phase
        .contact_pair(a, b)
        .is_none_or(|p| !p.has_any_active_contact()));
    world
        .colliders
        .set_parent(b, Some(second_body), &mut world.bodies);
    world.step();
    assert!(world
        .narrow_phase
        .contact_pair(a, b)
        .unwrap()
        .has_any_active_contact());
    assert_eq!(
        positions,
        (*world.colliders[a].position(), *world.colliders[b].position())
    );
}

#[derive(Default)]
struct CollisionEvents(std::sync::Mutex<Vec<CollisionEvent>>);

impl rapier3d::pipeline::EventHandler for CollisionEvents {
    fn handle_collision_event(
        &self,
        _: &RigidBodySet,
        _: &ColliderSet,
        event: CollisionEvent,
        _: Option<&ContactPair>,
    ) {
        self.0.lock().unwrap().push(event);
    }

    fn handle_contact_force_event(
        &self,
        _: Real,
        _: &RigidBodySet,
        _: &ColliderSet,
        _: &ContactPair,
        _: Real,
    ) {}

    fn handle_soft_body_tear_event(&self, _: &SoftBodySet, _: &SoftBodyTearEvent) {}
}

/// Collision type changes rediscover stationary contacts and sensors; solver groups
/// never suppress the resulting collision notifications.
#[test]
fn active_type_changes_rediscover_without_motion_and_keep_solver_filtered_events() {
    for sensor in [false, true] {
        let (mut world, a, b) = overlapping_world();
        world.gravity = Vector::ZERO;
        world.colliders[a].set_sensor(sensor);
        world.colliders[a].set_active_events(ActiveEvents::COLLISION_EVENTS);
        world.colliders[a].set_solver_groups(InteractionGroups::none());
        let positions = (
            *world.colliders[a].position(),
            *world.colliders[b].position(),
        );
        let events = CollisionEvents::default();
        world.step_with_events(&(), &events);
        assert!(events.0.lock().unwrap().is_empty());
        for _ in 0..2 {
            // Only one collider opts in. Both sides' active types must still be tested.
            world.colliders[b].set_active_collision_types(ActiveCollisionTypes::all());
            world.step_with_events(&(), &events);
            let emitted = std::mem::take(&mut *events.0.lock().unwrap());
            assert_eq!(emitted.len(), 1);
            assert!(matches!(emitted[0], CollisionEvent::Started(..)));
            if sensor {
                assert_eq!(world.narrow_phase.intersection_pair(a, b), Some(true));
            } else {
                assert!(world
                    .narrow_phase
                    .contact_pair(a, b)
                    .unwrap()
                    .has_any_active_contact());
            }
            world.step_with_events(&(), &events);
            assert!(events.0.lock().unwrap().is_empty()); // No duplicate Started.
            world.colliders[b].set_active_collision_types(ActiveCollisionTypes::default());
            world.step_with_events(&(), &events);
            let emitted = std::mem::take(&mut *events.0.lock().unwrap());
            assert_eq!(emitted.len(), 1);
            assert!(matches!(emitted[0], CollisionEvent::Stopped(..)));
        }
        assert_eq!(
            positions,
            (*world.colliders[a].position(), *world.colliders[b].position())
        );
    }
}
