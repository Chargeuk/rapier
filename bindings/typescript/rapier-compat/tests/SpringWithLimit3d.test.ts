import {
    ColliderDesc,
    GenericImpulseJoint,
    init,
    JointData,
    JointType,
    RigidBody,
    RigidBodyDesc,
    SpringImpulseJoint,
    World,
} from "../builds/3d/pkg";

const zero = {x: 0, y: 0, z: 0};
const directions = [
    {x: 1, y: 0, z: 0},
    {x: -1, y: 0, z: 0},
    {x: 0, y: 1, z: 0},
    {x: 0, y: -1, z: 0},
    {x: 0, y: 0, z: 1},
    {x: 0, y: 0, z: -1},
    {x: 1 / Math.sqrt(3), y: -1 / Math.sqrt(3), z: 1 / Math.sqrt(3)},
];
const magnitude = (v: {x: number; y: number; z: number}) =>
    Math.hypot(v.x, v.y, v.z);

describe("springWithLimit in the actual 3D WASM package", () => {
    let world: World;
    beforeAll(async () => {
        await init();
    });
    beforeEach(() => {
        world = new World(zero);
        world.timestep = 1 / 120;
    });
    afterEach(() => {
        world.free();
    });

    function fixture(
        position = {x: 2, y: 0, z: 0},
        restLength = 1,
        stiffness = 80,
        damping = 18,
        maximumLength = 3,
        mass = 1,
    ) {
        const parent = world.createRigidBody(RigidBodyDesc.fixed());
        const body = world.createRigidBody(
            RigidBodyDesc.dynamic()
                .setTranslation(position.x, position.y, position.z)
                .setCanSleep(false),
        );
        world.createCollider(ColliderDesc.ball(0.1).setMass(mass), body);
        const joint = world.createImpulseJoint(
            JointData.springWithLimit(
                restLength, stiffness, damping, maximumLength, zero, zero,
            ),
            parent, body, true,
        ) as SpringImpulseJoint;
        expect(joint).toBeInstanceOf(SpringImpulseJoint);
        expect(joint).toBeInstanceOf(GenericImpulseJoint);
        expect(joint.type()).toBe(JointType.Spring);
        return {parent, body, joint};
    }

    function step(body: RigidBody, count: number) {
        for (let i = 0; i < count; i += 1) {
            world.step();
            for (const v of [body.translation(), body.linvel(), body.angvel()]) {
                expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
            }
            expect(Number.isFinite(body.rotation().w)).toBe(true);
        }
    }

    test("one joint carries the motor and limit; getters survive snapshot restore", () => {
        const {joint, body} = fixture();
        expect(world.impulseJoints.len()).toBe(1);
        expect(joint.restLength()).toBe(1);
        expect(joint.stiffness()).toBe(80);
        expect(joint.damping()).toBe(18);
        expect(joint.limitsEnabled()).toBe(true);
        expect(joint.maximumLength()).toBe(3);
        step(body, 30);
        const restored = World.restoreSnapshot(world.takeSnapshot());
        try {
            const copy = restored.getImpulseJoint(joint.handle) as SpringImpulseJoint;
            expect(copy).toBeInstanceOf(SpringImpulseJoint);
            expect(copy.restLength()).toBe(1);
            expect(copy.stiffness()).toBe(80);
            expect(copy.damping()).toBe(18);
            expect(copy.maximumLength()).toBe(3);
            copy.configureSpring(0.5, 40, 12);
            copy.setMaximumLength(2);
            expect(joint.restLength()).toBe(1);
            expect(joint.maximumLength()).toBe(3);
            expect(restored.impulseJoints.len()).toBe(1);
        } finally {
            restored.free();
        }
    });

    test.each([0.5, 2])("restores a compressed or stretched spring from %s metres", (distance) => {
        const {body} = fixture({x: distance, y: 0, z: 0});
        step(body, 1);
        expect(body.linvel().x * (1 - distance)).toBeGreaterThan(0);
        step(body, 599);
        expect(Math.abs(magnitude(body.translation()) - 1)).toBeLessThan(0.005);
        expect(magnitude(body.linvel())).toBeLessThan(0.005);
    });

    test("damping dissipates radial motion compared with the same undamped spring", () => {
        const undamped = fixture({x: 1, y: 0, z: 0}, 1, 40, 0);
        const damped = fixture({x: 0, y: 1, z: 0}, 1, 40, 16);
        // Separate bodies have no contacts with each other at these distances.
        undamped.joint.setContactsEnabled(false);
        damped.joint.setContactsEnabled(false);
        undamped.body.setLinvel({x: 2, y: 0, z: 0}, true);
        damped.body.setLinvel({x: 0, y: 2, z: 0}, true);
        step(damped.body, 240);
        const energy = (body: RigidBody) =>
            magnitude(body.linvel()) ** 2 +
            40 * (magnitude(body.translation()) - 1) ** 2;
        expect(energy(undamped.body)).toBeGreaterThan(0.1);
        expect(energy(damped.body)).toBeLessThan(energy(undamped.body) * 0.1);
    });

    test.each(directions)("limits radial travel with direction %j", (direction) => {
        const {body, joint} = fixture(direction, 0.5, 20, 1, 1.5);
        body.setLinvel({x: direction.x * 20, y: direction.y * 20, z: direction.z * 20}, true);
        let farthest = 0;
        for (let i = 0; i < 600; i += 1) {
            step(body, 1);
            farthest = Math.max(farthest, magnitude(body.translation()));
        }
        expect(farthest).toBeGreaterThan(1.4); // Prove the stop was exercised.
        // Rapier's discrete velocity constraint allows a small solver tolerance.
        expect(farthest).toBeLessThan(1.55);
        expect(joint.maximumLength()).toBe(1.5);
        expect(world.impulseJoints.len()).toBe(1);
    });

    test("zero rest length settles from a diagonal and from coincident anchors", () => {
        const {body, joint} = fixture({x: 0.4, y: -0.5, z: 0.3}, 0);
        step(body, 600);
        expect(magnitude(body.translation())).toBeLessThan(0.005);
        expect(magnitude(body.linvel())).toBeLessThan(0.005);
        body.setTranslation(zero, true);
        body.setLinvel(zero, true);
        joint.configureSpring(0, 0, 0);
        step(body, 20);
        expect(magnitude(body.translation())).toBe(0);
        joint.configureSpring(0, 80, 18);
        body.setLinvel({x: 0, y: 0, z: 1}, true);
        step(body, 600);
        expect(magnitude(body.translation())).toBeLessThan(0.005);
    });

    test("live motor and stop updates preserve joint handle, bodies, colliders and free rotation", () => {
        const {body, joint} = fixture();
        const handle = joint.handle;
        const bodyHandle = body.handle;
        const colliderHandle = body.collider(0).handle;
        joint.configureSpring(0.5, 120, 22);
        step(body, 600);
        expect(Math.abs(body.translation().x - 0.5)).toBeLessThan(0.005);
        joint.setMaximumLength(0.75);
        joint.configureSpring(0.5, 0, 0);
        body.setLinvel({x: 10, y: 0, z: 0}, true);
        step(body, 240);
        expect(magnitude(body.translation())).toBeGreaterThan(0.7);
        expect(magnitude(body.translation())).toBeLessThan(0.8);
        joint.setMaximumLength(2.5);
        joint.configureSpring(2, 80, 18);
        body.setAngvel({x: 0, y: 1, z: 0}, true);
        step(body, 600);
        expect(Math.abs(magnitude(body.translation()) - 2)).toBeLessThan(0.005);
        // Float32 gyroscopic integration permits small drift over five seconds.
        expect(Math.abs(body.angvel().y - 1)).toBeLessThan(0.001);
        expect(joint.handle).toBe(handle);
        expect(body.handle).toBe(bodyHandle);
        expect(body.collider(0).handle).toBe(colliderHandle);
        expect(world.impulseJoints.len()).toBe(1);
    });

    test("local anchors define the stop distance rather than body centres", () => {
        const {parent, body, joint} = fixture({x: 0, y: 2, z: 0}, 0.5, 0, 0, 1);
        joint.setAnchor1({x: 0, y: 1, z: 0});
        joint.setAnchor2({x: 0, y: -0.5, z: 0});
        body.setLinvel({x: 0, y: 10, z: 0}, true);
        step(body, 240);
        expect(parent.translation()).toEqual(zero);
        expect(body.translation().y).toBeGreaterThan(2.4);
        expect(body.translation().y).toBeLessThan(2.55);
    });

    test("plain Spring and Rope descriptors retain their unlimited and limit-only behavior", () => {
        const {parent, body, joint} = fixture();
        world.removeImpulseJoint(joint, true);
        const plain = world.createImpulseJoint(JointData.spring(1, 80, 18, zero, zero), parent, body, true) as SpringImpulseJoint;
        expect(plain).toBeInstanceOf(GenericImpulseJoint);
        expect(typeof plain.configureMotorPosition).toBe("function");
        expect(plain.maximumLength()).toBeUndefined();
        plain.configureSpring(0.5, 80, 18);
        step(body, 600);
        expect(Math.abs(body.translation().x - 0.5)).toBeLessThan(0.005);
        world.removeImpulseJoint(plain, true);
        world.createImpulseJoint(JointData.rope(1, zero, zero), parent, body, true);
        body.setLinvel({x: 10, y: 0, z: 0}, true);
        step(body, 240);
        expect(body.translation().x).toBeGreaterThan(0.95);
        expect(body.translation().x).toBeLessThan(1.05);
        expect(world.impulseJoints.len()).toBe(1);
    });

    test("ForceBased response uses total compound mass without counting collider mass twice", () => {
        const light = fixture({x: 2, y: 0, z: 0}, 1, 80, 0, 3, 1);
        const heavy = fixture({x: 0, y: 2, z: 0}, 1, 80, 0, 3, 1);
        for (const offset of [-0.5, 0.5]) {
            world.createCollider(ColliderDesc.ball(0.1).setMass(1).setTranslation(offset, 0, 0), heavy.body);
        }
        heavy.body.setAdditionalMass(1, true);
        heavy.body.recomputeMassPropertiesFromColliders();
        step(heavy.body, 1);
        expect(light.body.mass()).toBeCloseTo(1, 5);
        expect(heavy.body.mass()).toBeCloseTo(4, 5);
        expect(Math.abs(light.body.linvel().x)).toBeGreaterThan(Math.abs(heavy.body.linvel().y) * 3);
    });

    test.each([0, 0.5, 1])("existing engine gravity scale %s combines with the radial spring", (scale) => {
        world.gravity = {x: 0, y: -10, z: 0};
        const {body} = fixture({x: 0, y: -1, z: 0}, 1, 100, 20, 2, 2);
        body.setGravityScale(scale, true);
        step(body, 1200);
        // ForceBased equilibrium extension = mass * gravity * scale / stiffness.
        expect(Math.abs(magnitude(body.translation()) - (1 + 0.2 * scale))).toBeLessThan(0.01);
        expect(magnitude(body.linvel())).toBeLessThan(0.005);
    });

    const invalid = [NaN, Infinity, -Infinity, -1, Number.MAX_VALUE, 1e-50];
    test.each(invalid)("rejects invalid scalar %s at creation and in live updates without mutation", (value) => {
        const {joint, body} = fixture();
        const before = world.takeSnapshot();
        for (let index = 0; index < 4; index += 1) {
            const args: [number, number, number, number] = [1, 80, 18, 3];
            args[index] = value;
            expect(() => JointData.springWithLimit(...args, zero, zero)).toThrow(RangeError);
        }
        expect(() => joint.configureSpring(value, 80, 18)).toThrow(RangeError);
        expect(() => joint.configureSpring(1, value, 18)).toThrow(RangeError);
        expect(() => joint.configureSpring(1, 80, value)).toThrow(RangeError);
        expect(() => joint.setMaximumLength(value)).toThrow(RangeError);
        expect(world.takeSnapshot()).toEqual(before);
        expect([joint.restLength(), joint.stiffness(), joint.damping(), joint.maximumLength()]).toEqual([1, 80, 18, 3]);
        step(body, 600);
        expect(Math.abs(body.translation().x - 1)).toBeLessThan(0.005);
    });

    test("rejects inconsistent lengths, invalid anchors and mutated descriptors before creating native state", () => {
        const {parent, body, joint} = fixture();
        const before = world.takeSnapshot();
        expect(() => JointData.springWithLimit(1, 80, 18, 0, zero, zero)).toThrow(RangeError);
        expect(() => JointData.springWithLimit(2, 80, 18, 1, zero, zero)).toThrow(RangeError);
        expect(() => joint.configureSpring(4, 80, 18)).toThrow(RangeError);
        expect(() => joint.setMaximumLength(0.5)).toThrow(RangeError);
        expect(() => joint.setMaximumLength(0)).toThrow(RangeError);
        for (const component of ["x", "y", "z"] as const) {
            for (const value of [NaN, Infinity, Number.MAX_VALUE, 1e-50]) {
                const badAnchor = {...zero, [component]: value};
                expect(() => JointData.springWithLimit(1, 80, 18, 3, badAnchor, zero)).toThrow(RangeError);
                expect(() => JointData.springWithLimit(1, 80, 18, 3, zero, badAnchor)).toThrow(RangeError);
            }
        }
        const descriptor = JointData.springWithLimit(1, 80, 18, 3, zero, zero);
        descriptor.length = 4;
        expect(() => world.createImpulseJoint(descriptor, parent, body, true)).toThrow(RangeError);
        descriptor.length = 1;
        descriptor.anchor1 = {x: NaN, y: 0, z: 0};
        expect(() => world.createImpulseJoint(descriptor, parent, body, true)).toThrow(RangeError);
        expect(world.takeSnapshot()).toEqual(before);
        expect(world.impulseJoints.len()).toBe(1);
    });

    test("accepts equality after f32 rounding and rejects stale joint updates", () => {
        const {joint} = fixture(zero, 0.1, 0, 0, 0.1);
        joint.configureSpring(0.1, 0, 0);
        joint.setMaximumLength(0.1);
        expect(joint.restLength()).toBe(Math.fround(0.1));
        expect(joint.maximumLength()).toBe(Math.fround(0.1));
        world.removeImpulseJoint(joint, true);
        const before = world.takeSnapshot();
        expect(() => joint.configureSpring(0, 1, 1)).toThrow("removed");
        expect(() => joint.setMaximumLength(1)).toThrow("removed");
        expect(world.takeSnapshot()).toEqual(before);
    });
});
