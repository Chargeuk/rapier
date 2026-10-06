//! Joint warm-start opt-in keeps default contacts/iterations and handles motor updates/teleports.
use rapier3d::prelude::*;

fn bend(world: &PhysicsWorld, parent: RigidBodyHandle, child: RigidBodyHandle) -> f32 {
    let relative = world.bodies[parent].rotation().inverse() * *world.bodies[child].rotation();
    2.0 * relative.z.atan2(relative.w)
}

fn exercise_motor(warmstart: bool) {
    let mut world = PhysicsWorld::new();
    world.gravity = Vector::ZERO;
    let defaults = world.integration_parameters;
    assert!(!defaults.warmstart_joints);
    world.integration_parameters.warmstart_joints = warmstart;
    let expected = IntegrationParameters {
        warmstart_joints: warmstart,
        ..defaults
    };
    let parent = world.insert_body(RigidBodyBuilder::fixed());
    let (child, _) = world.insert(
        RigidBodyBuilder::dynamic().can_sleep(false),
        ColliderBuilder::ball(0.25),
    );
    let joint = world.insert_impulse_joint(
        parent,
        child,
        RevoluteJointBuilder::new(Vector::Z)
            .contacts_enabled(false)
            .motor_model(MotorModel::AccelerationBased)
            .motor_position(0.7, 1000.0, 60.0),
    );
    let set_target = |world: &mut PhysicsWorld, target: f32| {
        world
            .impulse_joints
            .get_mut(joint, true)
            .unwrap()
            .data
            .set_motor_position(JointAxis::AngX, target, 1000.0, 60.0);
    };
    let step = |world: &mut PhysicsWorld, count: usize| {
        for _ in 0..count {
            world.step();
            let body = &world.bodies[child];
            assert!(body.translation().is_finite() && body.rotation().is_finite());
            assert!(body.linvel().is_finite() && body.angvel().is_finite());
            assert!(world.quarantine().is_empty());
        }
    };
    for target in [0.7, -0.9, 1.2] {
        set_target(&mut world, target);
        step(&mut world, 180);
        assert!((bend(&world, parent, child) - target).abs() < 0.05);
        assert!(
            (world.bodies[child].translation() - world.bodies[parent].translation()).length()
                < 0.025
        );
    }
    for i in 0..24 {
        set_target(&mut world, if i % 2 == 0 { -0.8 } else { 0.8 });
        step(&mut world, 4);
    }
    // Test-world-only teleport, retaining the same joint and solver configuration.
    let position = Vector::new(2.0, -3.0, 1.0);
    world.bodies[parent].set_translation(position, true);
    world.bodies[parent].set_rotation(Rotation::from_axis_angle(Vector::Z, 0.35), true);
    world.bodies[child].set_translation(position, true);
    world.bodies[child].set_rotation(Rotation::from_axis_angle(Vector::Z, -0.5), true);
    world.bodies[child].set_linvel(Vector::ZERO, true);
    world.bodies[child].set_angvel(Vector::ZERO, true);
    set_target(&mut world, 0.6);
    step(&mut world, 240);
    assert!((bend(&world, parent, child) - 0.6).abs() < 0.05);
    assert!((world.bodies[child].translation() - position).length() < 0.025);
    assert_eq!(world.integration_parameters, expected);
}

#[test]
fn default_joint_warmstart_off_handles_motor_targets_and_teleports() {
    exercise_motor(false);
}

#[test]
fn opt_in_joint_warmstart_handles_motor_targets_and_teleports() {
    exercise_motor(true);
}
