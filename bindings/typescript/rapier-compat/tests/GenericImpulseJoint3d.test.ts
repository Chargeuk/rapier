import {
    ColliderDesc,
    GenericImpulseJoint,
    init,
    JointAxesMask,
    JointAxis,
    JointData,
    JointType,
    MotorModel,
    RigidBody,
    RigidBodyDesc,
    World,
} from "../builds/3d/pkg";

const zero = {x: 0, y: 0, z: 0};
const identity = {x: 0, y: 0, z: 0, w: 1};
const rotated = {x: 0.3, y: -0.4, z: 0.5, w: Math.sqrt(0.5)};
const linearAxes = [
    {axis: JointAxis.LinX, component: "x" as const, angular: false},
    {axis: JointAxis.LinY, component: "y" as const, angular: false},
    {axis: JointAxis.LinZ, component: "z" as const, angular: false},
];
const axes = [
    ...linearAxes,
    {axis: JointAxis.AngX, component: "x" as const, angular: true},
    {axis: JointAxis.AngY, component: "y" as const, angular: true},
    {axis: JointAxis.AngZ, component: "z" as const, angular: true},
];
type Axis = (typeof axes)[number];

function magnitude(vector: {x: number; y: number; z: number}) {
    return Math.hypot(vector.x, vector.y, vector.z);
}

describe("GenericImpulseJoint motors in the built 3D WASM package", () => {
    let world: World;

    beforeAll(async () => {
        await init();
    });
    beforeEach(() => {
        world = new World(zero);
    });
    afterEach(() => {
        world.free();
    });

    function fixture(position = zero, rotation = identity, mass = 1) {
        const target = world.createRigidBody(
            RigidBodyDesc.kinematicPositionBased(),
        );
        const body = world.createRigidBody(
            RigidBodyDesc.dynamic()
                .setCanSleep(false)
                .setTranslation(position.x, position.y, position.z)
                .setRotation(rotation),
        );
        const collider = world.createCollider(
            ColliderDesc.ball(0.5).setMass(mass),
            body,
        );
        // No locked axes: translation motors must not lock the body's rotation.
        const joint = world.createImpulseJoint(
            JointData.generic(zero, zero, {x: 1, y: 0, z: 0}, 0 as JointAxesMask),
            target,
            body,
            true,
        ) as GenericImpulseJoint;
        expect(joint).toBeInstanceOf(GenericImpulseJoint);
        expect(joint.type()).toBe(JointType.Generic);
        // The first body defines the world basis. Align the second joint frame
        // with it even when the dynamic body starts with a compound rotation.
        joint.setLocalFrame1(zero, identity);
        joint.setLocalFrame2(zero, {
            x: -rotation.x,
            y: -rotation.y,
            z: -rotation.z,
            w: rotation.w,
        });
        return {target, body, collider, joint};
    }

    function expectFinite(body: RigidBody) {
        const q = body.rotation();
        for (const v of [body.translation(), body.linvel(), body.angvel(), q]) {
            expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
        }
        expect(Number.isFinite(q.w)).toBe(true);
    }

    function step(body: RigidBody, count: number) {
        for (let i = 0; i < count; i += 1) {
            world.step();
            expectFinite(body);
        }
    }

    function coordinate(body: RigidBody, axis: Axis) {
        if (!axis.angular) return body.translation()[axis.component];
        const q = body.rotation();
        return 2 * Math.atan2(q[axis.component], q.w);
    }

    function velocity(body: RigidBody, axis: Axis) {
        return (axis.angular ? body.angvel() : body.linvel())[axis.component];
    }

    function expectOtherAxesAtRest(body: RigidBody, axis: Axis) {
        const p = body.translation();
        const q = body.rotation();
        const v = body.linvel();
        const w = body.angvel();
        for (const component of ["x", "y", "z"] as const) {
            if (axis.angular || component !== axis.component) {
                expect(Math.abs(p[component])).toBeLessThan(0.001);
                expect(Math.abs(v[component])).toBeLessThan(0.001);
            }
            if (!axis.angular || component !== axis.component) {
                expect(Math.abs(q[component])).toBeLessThan(0.001);
                expect(Math.abs(w[component])).toBeLessThan(0.001);
            }
        }
    }

    test.each(axes)(
        "configureMotorModel changes mass dependence only on axis $axis",
        (axis) => {
            const firstVelocity = (model: MotorModel, mass: number) => {
                const {body, target, joint} = fixture(zero, identity, mass);
                joint.configureMotorModel(axis.axis, model);
                joint.configureMotorVelocity(axis.axis, 1, 1);
                joint.setMotorMaxForce(axis.axis, 1000);
                step(body, 1);
                const result = velocity(body, axis);
                expect(result).toBeGreaterThan(0);
                expectOtherAxesAtRest(body, axis);
                world.removeRigidBody(body);
                world.removeRigidBody(target);
                return result;
            };
            const accelerationLight = firstVelocity(
                MotorModel.AccelerationBased,
                1,
            );
            const accelerationHeavy = firstVelocity(
                MotorModel.AccelerationBased,
                4,
            );
            expect(accelerationHeavy / accelerationLight).toBeCloseTo(1, 4);
            const forceLight = firstVelocity(MotorModel.ForceBased, 1);
            const forceHeavy = firstVelocity(MotorModel.ForceBased, 4);
            expect(forceHeavy / forceLight).toBeLessThan(0.6);
        },
    );

    test.each(axes)(
        "configureMotorVelocity reaches a signed target on axis $axis",
        (axis) => {
            const {body, joint} = fixture();
            const targetVelocity = axis.component === "y" ? -0.7 : 0.7;
            joint.configureMotorModel(axis.axis, MotorModel.AccelerationBased);
            joint.configureMotorVelocity(axis.axis, targetVelocity, 12);
            joint.setMotorMaxForce(axis.axis, 100);
            step(body, 60);
            expect(velocity(body, axis)).toBeCloseTo(targetVelocity, 2);
            expect(
                coordinate(body, axis) * Math.sign(targetVelocity),
            ).toBeGreaterThan(0.4);
            expectOtherAxesAtRest(body, axis);
            // A live target update must replace the previous velocity target.
            joint.configureMotorVelocity(axis.axis, -targetVelocity, 12);
            step(body, 60);
            expect(velocity(body, axis)).toBeCloseTo(-targetVelocity, 2);
            expectOtherAxesAtRest(body, axis);
        },
    );

    test.each(axes)(
        "configureMotorPosition settles at a signed target on axis $axis",
        (axis) => {
            const {body, joint} = fixture();
            const position = axis.component === "y" ? -0.4 : 0.4;
            joint.configureMotorModel(axis.axis, MotorModel.AccelerationBased);
            joint.configureMotorPosition(axis.axis, position, 100, 20);
            joint.setMotorMaxForce(axis.axis, 100);
            step(body, 240);
            expect(coordinate(body, axis)).toBeCloseTo(position, 2);
            expect(Math.abs(velocity(body, axis))).toBeLessThan(0.005);
            expectOtherAxesAtRest(body, axis);
        },
    );

    test.each(axes)(
        "configureMotor applies both targets and gains on axis $axis",
        (axis) => {
            const {body, joint} = fixture();
            const sign = axis.component === "y" ? -1 : 1;
            const position = sign * 0.4;
            const speed = sign * 0.3;
            const stiffness = 40;
            const damping = 12;
            joint.configureMotorModel(axis.axis, MotorModel.AccelerationBased);
            joint.configureMotor(axis.axis, position, speed, stiffness, damping);
            joint.setMotorMaxForce(axis.axis, 100);
            step(body, 300);
            // At rest, error * ERP = speed, with ERP = k / (h * k + d).
            // Linear error is position - target; generic angular error is
            // sin(angle / 2) - sin(target / 2), so invert that coordinate.
            // Omitting h * speed adds at most world.timestep * abs(speed)
            // (0.005 here) in error coordinates, or < 0.011 radians after
            // angular conversion. The existing 0.02 tolerance covers this
            // substep bias while distinguishing both nonzero targets.
            const offset = (damping * speed) / stiffness;
            const equilibrium = axis.angular
                ? 2 * Math.asin(Math.sin(position / 2) + offset)
                : position + offset;
            expect(Math.abs(coordinate(body, axis) - equilibrium)).toBeLessThan(
                0.02,
            );
            expect(Math.abs(velocity(body, axis))).toBeLessThan(0.005);
            expectOtherAxesAtRest(body, axis);
            joint.configureMotorPosition(axis.axis, 0, stiffness, damping);
            step(body, 300);
            expect(Math.abs(coordinate(body, axis))).toBeLessThan(0.005);
        },
    );

    test.each(axes)(
        "setMotorMaxForce bounds force/torque and releases axis $axis at zero",
        (axis) => {
            const {body, joint} = fixture();
            const cap = 0.4;
            joint.configureMotorModel(axis.axis, MotorModel.ForceBased);
            joint.configureMotorVelocity(axis.axis, 3, 100);
            joint.setMotorMaxForce(axis.axis, cap);
            step(body, 1);
            const speed = velocity(body, axis);
            // Unit-mass radius-0.5 ball: mass = 1, moment of inertia = 0.1.
            // The total motor impulse per step cannot exceed cap * dt.
            const effectiveMass = axis.angular ? 0.1 : 1;
            expect(speed).toBeGreaterThan(0);
            expect(speed).toBeLessThanOrEqual(
                (cap * world.timestep) / effectiveMass + 0.00001,
            );
            joint.configureMotorPosition(axis.axis, 0, 100, 20);
            joint.setMotorMaxForce(axis.axis, 0);
            step(body, 30);
            expect(velocity(body, axis)).toBeCloseTo(speed, 5);
            joint.setMotorMaxForce(axis.axis, 10);
            step(body, 300);
            expect(Math.abs(coordinate(body, axis))).toBeLessThan(0.005);
            expect(Math.abs(velocity(body, axis))).toBeLessThan(0.005);
            expectOtherAxesAtRest(body, axis);
        },
    );

    test("independent XYZ gains use the world basis of a colliderless target with a rotated body", () => {
        const {target, body, joint} = fixture({x: 1, y: 1, z: 1}, rotated);
        expect(target.numColliders()).toBe(0);
        const stiffnesses = [16, 64, 256];
        linearAxes.forEach(({axis}, index) => {
            const stiffness = stiffnesses[index];
            joint.configureMotorModel(axis, MotorModel.AccelerationBased);
            joint.configureMotorPosition(
                axis,
                0,
                stiffness,
                2 * Math.sqrt(stiffness),
            );
            joint.setMotorMaxForce(axis, 10000);
        });
        step(body, 12);
        const p = body.translation();
        expect(p.z).toBeGreaterThan(0);
        expect(p.z).toBeLessThan(p.y - 0.05);
        expect(p.y).toBeLessThan(p.x - 0.05);
        expect(p.x).toBeLessThan(1);
        step(body, 480);
        expect(magnitude(body.translation())).toBeLessThan(0.005);
        expect(magnitude(body.linvel())).toBeLessThan(0.005);
        const q = body.rotation();
        expect(
            Math.abs(
                q.x * rotated.x +
                    q.y * rotated.y +
                    q.z * rotated.z +
                    q.w * rotated.w,
            ),
        ).toBeCloseTo(1, 5);
        // Moving the kinematic target translates the world-space equilibrium.
        target.setNextKinematicTranslation({x: 0.4, y: -0.3, z: 0.2});
        step(body, 480);
        for (const {component} of linearAxes) {
            expect(body.translation()[component]).toBeCloseTo(
                target.translation()[component],
                2,
            );
        }
    });

    test.each(linearAxes)(
        "zero gains and force release world axis $axis including damping, and allow reactivation",
        ({axis, component}) => {
            const {body, joint} = fixture({x: 1, y: 1, z: 1}, rotated);
            for (const other of linearAxes) {
                joint.configureMotorModel(other.axis, MotorModel.AccelerationBased);
                joint.configureMotorPosition(other.axis, 0, 60, 16);
                joint.setMotorMaxForce(other.axis, 100);
            }
            joint.configureMotorPosition(axis, 0, 0, 0);
            // Configuring zero coefficients still enables a native motor row;
            // a zero force cap releases it without changing the solver.
            joint.setMotorMaxForce(axis, 0);
            body.applyImpulse({...zero, [component]: 0.6}, true);
            step(body, 180);
            expect(body.linvel()[component]).toBeCloseTo(0.6, 4);
            expect(body.translation()[component]).toBeGreaterThan(2.5);
            for (const other of linearAxes) {
                if (other.axis !== axis) {
                    expect(
                        Math.abs(body.translation()[other.component]),
                    ).toBeLessThan(0.005);
                }
            }
            joint.configureMotorPosition(axis, 0, 60, 16);
            joint.setMotorMaxForce(axis, 100);
            step(body, 300);
            expect(magnitude(body.translation())).toBeLessThan(0.005);
            expect(magnitude(body.linvel())).toBeLessThan(0.005);
        },
    );

    test("finite force motors yield to a collision and return to the unchanged target", () => {
        const {target, body, collider, joint} = fixture(zero, rotated);
        for (const {axis} of linearAxes) {
            joint.configureMotorModel(axis, MotorModel.ForceBased);
            joint.configureMotorPosition(axis, 0, 60, 16);
            joint.setMotorMaxForce(axis, 5);
        }
        const striker = world.createRigidBody(
            RigidBodyDesc.dynamic()
                .setCanSleep(false)
                .setTranslation(-2, 0, 0)
                .setLinvel(6, 0, 0),
        );
        const strikerCollider = world.createCollider(
            ColliderDesc.ball(0.5).setMass(2).setRestitution(0),
            striker,
        );
        let contacted = false;
        let displacement = 0;
        for (let i = 0; i < 60; i += 1) {
            step(body, 1);
            world.contactPair(collider, strikerCollider, (manifold) => {
                contacted = contacted || manifold.numContacts() > 0;
            });
            displacement = Math.max(displacement, body.translation().x);
        }
        expect(contacted).toBe(true);
        expect(displacement).toBeGreaterThan(0.1);
        expect(target.translation()).toEqual(zero);
        world.removeRigidBody(striker);
        step(body, 900);
        expect(target.translation()).toEqual(zero);
        expect(magnitude(body.translation())).toBeLessThan(0.01);
        expect(magnitude(body.linvel())).toBeLessThan(0.01);
    });
});
