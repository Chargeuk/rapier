import {
    ActiveCollisionTypes,
    Collider,
    ColliderDesc,
    init,
    JointData,
    Ray,
    RevoluteImpulseJoint,
    RigidBodyDesc,
    World,
} from "../builds/3d/pkg";

describe("Chargeuk 3D compatibility behaviour", () => {
    let world: World;
    beforeAll(async () => {
        await init();
    });
    beforeEach(() => {
        world = new World({x: 0, y: 0, z: 0});
    });
    afterEach(() => {
        world.free();
    });

    function desc(
        membership: number,
        mask: number,
        grouping: number,
        sensor = false,
    ) {
        // Parentless fixtures are fixed; upstream ALL omits the FIXED_FIXED bit.
        return ColliderDesc.ball(1)
            .setActiveCollisionTypes(ActiveCollisionTypes.FIXED_FIXED)
            .setSensor(sensor)
            .setBelongsToWithGrouping(membership)
            .setCollidesWithWithGrouping(mask)
            .setBelongsToGrouping(grouping);
    }

    function interacting(a: Collider, b: Collider, sensor: boolean) {
        if (sensor) return world.intersectionPair(a, b);
        let contacts = 0;
        world.contactPair(a, b, (manifold) => {
            contacts += manifold.numContacts();
        });
        return contacts > 0;
    }

    test("descriptor defaults and fluent setters preserve all three public fields", () => {
        const descriptor = ColliderDesc.ball(1);
        expect(descriptor.belongsToWithGrouping).toBe(0xffff_ffff);
        expect(descriptor.collidesWithWithGrouping).toBe(0xffff_ffff);
        expect(descriptor.belongsToGrouping).toBe(0xffff_ffff);
        expect(descriptor.setBelongsToWithGrouping(1)).toBe(descriptor);
        expect(descriptor.setCollidesWithWithGrouping(2)).toBe(descriptor);
        expect(descriptor.setBelongsToGrouping(7)).toBe(descriptor);
        expect([
            descriptor.belongsToWithGrouping,
            descriptor.collidesWithWithGrouping,
            descriptor.belongsToGrouping,
        ]).toEqual([1, 2, 7]);
    });

    test.each([false, true])(
        "descriptor propagation and stationary rediscovery (sensor=%s)",
        (sensor) => {
            const a = world.createCollider(desc(1, 0, 7, sensor));
            // Direct field assignment remains supported as well as fluent setters.
            const other = ColliderDesc.ball(1)
                .setTranslation(1, 0, 0)
                .setActiveCollisionTypes(ActiveCollisionTypes.FIXED_FIXED);
            other.belongsToWithGrouping = 2;
            other.collidesWithWithGrouping = 1;
            other.belongsToGrouping = 7;
            const b = world.createCollider(other);
            const positions = [a.translation(), b.translation()];
            world.step();
            expect(interacting(a, b, sensor)).toBe(false);
            a.setDetailedCollisionGroups(0xffff_ffff, 1, 2, 7);
            world.step();
            expect(interacting(a, b, sensor)).toBe(true);
            a.setDetailedCollisionGroups(0xffff_ffff, 1, 0, 7);
            world.step();
            expect(interacting(a, b, sensor)).toBe(false);
            a.setDetailedCollisionGroups(0xffff_ffff, 0, 0, 8);
            world.step();
            expect(interacting(a, b, sensor)).toBe(true);
            a.setDetailedCollisionGroups(0, 0, 0, 8);
            world.step();
            expect(interacting(a, b, sensor)).toBe(false);
            a.setCollisionGroups(0xffff_ffff);
            world.step();
            expect(interacting(a, b, sensor)).toBe(true);
            expect([a.translation(), b.translation()]).toEqual(positions);
        },
    );

    test("standard setter resets custom masks and ID to neutral values", () => {
        const a = world.createCollider(desc(1, 0, 0xffff_ffff, true));
        const b = world.createCollider(
            desc(2, 1, 0xffff_ffff).setTranslation(1, 0, 0),
        );
        world.step();
        expect(world.intersectionPair(a, b)).toBe(false);
        a.setCollisionGroups(0xffff_ffff);
        world.step();
        expect(world.intersectionPair(a, b)).toBe(true);
        // Neutral ID is MAX, so this new matching MAX mask must still be enforced.
        b.setDetailedCollisionGroups(0xffff_ffff, 2, 0, 0xffff_ffff);
        world.step();
        expect(world.intersectionPair(a, b)).toBe(false);
    });

    test("full-width unsigned masks and grouping IDs survive the WASM boundary", () => {
        const a = world.createCollider(
            desc(0x8000_0000, 0x4000_0000, 0x8000_0001, true),
        );
        const b = world.createCollider(
            desc(0x4000_0000, 0x8000_0000, 0x8000_0001).setTranslation(1, 0, 0),
        );
        world.step();
        expect(world.intersectionPair(a, b)).toBe(true);
        a.setDetailedCollisionGroups(0xffff_ffff, 0x8000_0000, 0, 0x8000_0001);
        world.step();
        expect(world.intersectionPair(a, b)).toBe(false);
    });

    test("solver setters never alter collision groups or the detailed predicate", () => {
        const a = world.createCollider(desc(1, 2, 7).setSolverGroups(0));
        const b = world.createCollider(desc(2, 1, 7).setTranslation(1, 0, 0));
        world.step();
        expect(interacting(a, b, false)).toBe(true);
        expect(a.solverGroups()).toBe(0);
        a.setSolverGroups(0x0001_0001);
        expect(a.solverGroups()).toBe(0x0001_0001);
        expect(a.collisionGroups()).toBe(0xffff_ffff);
        world.step();
        expect(interacting(a, b, false)).toBe(true);
        a.setDetailedCollisionGroups(0xffff_ffff, 1, 0, 7);
        a.setSolverGroups(0xffff_ffff);
        world.step();
        expect(interacting(a, b, false)).toBe(false);
        expect(a.collisionGroups()).toBe(0xffff_ffff);
    });

    test("basic query groups remain neutral rather than acquiring same-group masks", () => {
        const collider = world.createCollider(desc(1, 0, 7));
        world.step();
        const ray = new Ray({x: -3, y: 0, z: 0}, {x: 1, y: 0, z: 0});
        expect(
            world.castRay(ray, 10, true, undefined, 0xffff_ffff)?.collider
                .handle,
        ).toBe(collider.handle);
        expect(world.castRay(ray, 10, true, undefined, 0)).toBeNull();
    });

    test.each([false, true])(
        "revolute limits at creation and after updates (independent axes=%s)",
        (independentAxes) => {
            const body1 = world.createRigidBody(RigidBodyDesc.fixed());
            const body2 = world.createRigidBody(RigidBodyDesc.dynamic());
            const anchor = {x: 0, y: 0, z: 0};
            const make = () =>
                independentAxes
                    ? JointData.revoluteWithAxes(
                          anchor,
                          anchor,
                          {x: 1, y: 0, z: 0},
                          {x: 0, y: 1, z: 0},
                      )
                    : JointData.revolute(anchor, anchor, {x: 0, y: 0, z: 1});
            for (const enabled of [false, true]) {
                const data = make();
                data.limitsEnabled = enabled;
                data.limits = [-0.4, 0.7];
                const joint = world.createImpulseJoint(
                    data,
                    body1,
                    body2,
                    true,
                ) as RevoluteImpulseJoint;
                expect(joint.limitsEnabled()).toBe(enabled);
                if (enabled) {
                    expect(joint.limitsMin()).toBeCloseTo(-0.4);
                    expect(joint.limitsMax()).toBeCloseTo(0.7);
                }
                if (independentAxes) {
                    expect(joint.frameX1()).not.toEqual(joint.frameX2());
                }
                joint.setLimits(-0.2, 0.3);
                expect(joint.limitsEnabled()).toBe(true);
                expect(joint.limitsMin()).toBeCloseTo(-0.2);
                expect(joint.limitsMax()).toBeCloseTo(0.3);
                const a1 = {x: 1, y: 2, z: 3};
                const a2 = {x: 3, y: 2, z: 1};
                joint.setAnchor1(a1);
                joint.setAnchor2(a2);
                expect(joint.anchor1()).toEqual(a1);
                expect(joint.anchor2()).toEqual(a2);
                world.removeImpulseJoint(joint, true);
            }
        },
    );

    test("upstream resizing refreshes geometry and broad-phase queries", () => {
        const ball = world.createCollider(ColliderDesc.ball(0.1));
        const capsule = world.createCollider(
            ColliderDesc.capsule(0.5, 0.2).setTranslation(4, 0, 0),
        );
        const ray = new Ray({x: -2, y: 0.7, z: 0}, {x: 1, y: 0, z: 0});
        const capsuleRay = new Ray({x: 2, y: 1.3, z: 0}, {x: 1, y: 0, z: 0});
        world.step();
        expect(world.castRay(ray, 3, true)).toBeNull();
        expect(world.castRay(capsuleRay, 4, true)).toBeNull();
        ball.setRadius(1);
        capsule.setRadius(0.4);
        capsule.setHalfHeight(1.5);
        world.step();
        expect(ball.radius()).toBeCloseTo(1);
        expect(capsule.radius()).toBeCloseTo(0.4);
        expect(capsule.halfHeight()).toBeCloseTo(1.5);
        expect(world.castRay(ray, 3, true)?.collider.handle).toBe(ball.handle);
        expect(world.castRay(capsuleRay, 4, true)?.collider.handle).toBe(
            capsule.handle,
        );
        ball.setRadius(0.1);
        capsule.setHalfHeight(0.5);
        capsule.setRadius(0.2);
        world.step();
        expect(world.castRay(ray, 3, true)).toBeNull();
        expect(world.castRay(capsuleRay, 4, true)).toBeNull();
    });
});
