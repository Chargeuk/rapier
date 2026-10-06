import {
    ActiveCollisionTypes,
    Ball,
    Collider,
    ColliderDesc,
    init,
    JointData,
    MotorModel,
    Ray,
    RevoluteImpulseJoint,
    RigidBodyDesc,
    World,
} from "../builds/3d/pkg";

const masks32 = [
    0x8000, 0x10000, 0x4000_0000, 0x8000_0000, 0xc001_8000, 0xffff_ffff,
];

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

    test.each(masks32)(
        "separate descriptor/getter masks round-trip unsigned without truncation (%s)",
        (mask) => {
            const filter = ((mask << 1) | (mask >>> 31)) >>> 0;
            const descriptor = ColliderDesc.ball(1)
                .setDetailedCollisionGroups32(
                    mask | 0,
                    filter | 0,
                    1 << 31,
                    1 << 30,
                    0x8000_0001 | 0,
                )
                .setSolverGroups32(filter | 0, mask | 0);
            expect(descriptor.collisionMemberships).toBe(mask);
            expect(descriptor.collisionFilter).toBe(filter);
            const collider = world.createCollider(descriptor);
            expect(collider.collisionGroups32()).toEqual({
                memberships: mask,
                filter,
            });
            expect(collider.solverGroups32()).toEqual({
                memberships: filter,
                filter: mask,
            });
            expect(collider.belongsToWithGrouping()).toBe(0x8000_0000);
            expect(collider.collidesWithWithGrouping()).toBe(0x4000_0000);
            expect(collider.belongsToGrouping()).toBe(0x8000_0001);
            collider.setSolverGroups32(1 << 31, mask | 0);
            expect(collider.collisionGroups32()).toEqual({
                memberships: mask,
                filter,
            });
            expect(collider.belongsToGrouping()).toBe(0x8000_0001);
            collider.setCollisionGroups32(mask | 0, filter | 0);
            expect(collider.belongsToWithGrouping()).toBe(0xffff_ffff);
            expect(collider.collidesWithWithGrouping()).toBe(0xffff_ffff);
            expect(collider.belongsToGrouping()).toBe(0xffff_ffff);
            collider.setCollisionGroups(0x0002_0001);
            collider.setSolverGroups(0x0001_0002);
            expect(collider.collisionGroups()).toBe(0x0002_0001);
            expect(collider.collisionGroups32()).toEqual({
                memberships: 2,
                filter: 1,
            });
            expect(collider.solverGroups()).toBe(0x0001_0002);
            descriptor
                .setCollisionGroups(0x0002_0001)
                .setSolverGroups(0x0001_0002);
            const packed = world.createCollider(descriptor);
            expect(packed.collisionGroups32()).toEqual({
                memberships: 2,
                filter: 1,
            });
            expect(packed.solverGroups32()).toEqual({
                memberships: 1,
                filter: 2,
            });
        },
    );

    test("direct descriptor masks and partial overrides preserve packed defaults", () => {
        const descriptor = ColliderDesc.ball(1);
        descriptor.collisionMemberships = 1 << 31;
        descriptor.collisionFilter = (1 << 16) | (1 << 30);
        descriptor.solverMemberships = 1 << 30;
        descriptor.solverFilter = 1 << 31;
        const collider = world.createCollider(descriptor);
        expect(collider.collisionGroups32()).toEqual({
            memberships: 0x8000_0000,
            filter: 0x4001_0000,
        });
        expect(collider.solverGroups32()).toEqual({
            memberships: 0x4000_0000,
            filter: 0x8000_0000,
        });
        const partial = ColliderDesc.ball(1).setCollisionGroups(0x0002_0001);
        partial.collisionMemberships = 1 << 31;
        expect(world.createCollider(partial).collisionGroups32()).toEqual({
            memberships: 0x8000_0000,
            filter: 1,
        });
        const legacy = world.createCollider(ColliderDesc.ball(1));
        expect(legacy.collisionGroups32()).toEqual({
            memberships: 0xffff,
            filter: 0xffff,
        });
    });

    test.each([false, true])(
        "high standard and detailed masks rediscover stationary pairs (sensor=%s)",
        (sensor) => {
            for (const mask of masks32) {
                const filter = ((mask << 1) | (mask >>> 31)) >>> 0;
                const a = world.createCollider(
                    desc(1 << 31, 1 << 30, 7, sensor).setCollisionGroups32(
                        mask,
                        0,
                    ),
                );
                const b = world.createCollider(
                    desc(1 << 30, 1 << 31, 7)
                        .setTranslation(1, 0, 0)
                        .setCollisionGroups32(filter, mask),
                );
                const positions = [a.translation(), b.translation()];
                world.step();
                expect(interacting(a, b, sensor)).toBe(false);
                a.setDetailedCollisionGroups32(
                    mask,
                    filter,
                    1 << 31,
                    1 << 30,
                    7,
                );
                world.step();
                expect(interacting(a, b, sensor)).toBe(true);
                a.setDetailedCollisionGroups32(mask, 0, 1 << 31, 1 << 30, 7);
                world.step();
                expect(interacting(a, b, sensor)).toBe(false);
                a.setDetailedCollisionGroups32(mask, filter, 1 << 31, 0, 7);
                world.step();
                expect(interacting(a, b, sensor)).toBe(false);
                a.setDetailedCollisionGroups32(mask, filter, 1 << 31, 0, 8);
                world.step();
                expect(interacting(a, b, sensor)).toBe(true);
                a.setDetailedCollisionGroups32(0, filter, 1 << 31, 1 << 30, 8);
                world.step();
                expect(interacting(a, b, sensor)).toBe(false);
                expect([a.translation(), b.translation()]).toEqual(positions);
                world.removeCollider(a, false);
                world.removeCollider(b, false);
            }
        },
    );

    test("high solver masks change impulses but preserve contacts and detailed collision filtering", () => {
        // Unlike the stationary fixtures, this pair is fixed/dynamic.
        const a = world.createCollider(
            desc(1 << 30, 1 << 16, 7)
                .setActiveCollisionTypes(ActiveCollisionTypes.DEFAULT)
                .setCollisionGroups32(1 << 15, 1 << 31)
                .setSolverGroups32(1 << 30, 0),
        );
        const body = world.createRigidBody(
            RigidBodyDesc.dynamic().setCanSleep(false).setTranslation(1, 0, 0),
        );
        const b = world.createCollider(
            desc(1 << 16, 1 << 30, 7)
                .setActiveCollisionTypes(ActiveCollisionTypes.DEFAULT)
                .setCollisionGroups32(1 << 31, 1 << 15)
                .setSolverGroups32(1 << 16, 1 << 30),
            body,
        );
        world.step();
        expect(interacting(a, b, false)).toBe(true);
        expect(body.translation()).toEqual({x: 1, y: 0, z: 0});
        a.setSolverGroups32(1 << 30, 1 << 16);
        world.step();
        expect(body.translation().x).toBeGreaterThan(1);
        expect(a.collisionGroups32()).toEqual({
            memberships: 0x8000,
            filter: 0x8000_0000,
        });
        expect(a.belongsToGrouping()).toBe(7);
        a.setDetailedCollisionGroups32(1 << 15, 1 << 31, 1 << 30, 0, 7);
        world.step();
        expect(interacting(a, b, false)).toBe(false);
    });

    test.each(masks32)(
        "all world query families accept full-width groups (%s)",
        (mask) => {
            const filter = ((mask << 1) | (mask >>> 31)) >>> 0;
            const collider = world.createCollider(
                desc(0, 0, 7).setCollisionGroups32(mask, filter),
            );
            world.step();
            const ray = new Ray({x: -3, y: 0, z: 0}, {x: 1, y: 0, z: 0});
            // Non-solid ball feature projection is singular at the exact center.
            const point = {x: 0.25, y: 0, z: 0};
            const rotation = {x: 0, y: 0, z: 0, w: 1};
            const shape = new Ball(0.1);
            for (const allowed of [true, false]) {
                const groups = {
                    memberships: filter | 0,
                    filter: allowed ? mask | 0 : 0,
                };
                const handle = allowed ? collider.handle : null;
                expect(
                    world.castRay(ray, 10, true, undefined, groups)?.collider
                        .handle ?? null,
                ).toBe(handle);
                expect(
                    world.castRayAndGetNormal(ray, 10, true, undefined, groups)
                        ?.collider.handle ?? null,
                ).toBe(handle);
                expect(
                    world.projectPoint(point, true, undefined, groups)?.collider
                        .handle ?? null,
                ).toBe(handle);
                expect(
                    world.projectPointAndGetFeature(point, undefined, groups)
                        ?.collider.handle ?? null,
                ).toBe(handle);
                expect(
                    world.intersectionWithShape(
                        point,
                        rotation,
                        shape,
                        undefined,
                        groups,
                    )?.handle ?? null,
                ).toBe(handle);
                expect(
                    world.castShape(
                        ray.origin,
                        rotation,
                        ray.dir,
                        shape,
                        0,
                        10,
                        true,
                        undefined,
                        groups,
                    )?.collider.handle ?? null,
                ).toBe(handle);
                const rays: number[] = [];
                world.intersectionsWithRay(
                    ray,
                    10,
                    true,
                    (hit) => {
                        rays.push(hit.collider.handle);
                        return true;
                    },
                    undefined,
                    groups,
                );
                const points: number[] = [];
                world.intersectionsWithPoint(
                    point,
                    (hit) => {
                        points.push(hit.handle);
                        return true;
                    },
                    undefined,
                    groups,
                );
                const shapes: number[] = [];
                world.intersectionsWithShape(
                    point,
                    rotation,
                    shape,
                    (hit) => {
                        shapes.push(hit.handle);
                        return true;
                    },
                    undefined,
                    groups,
                );
                for (const hits of [rays, points, shapes]) {
                    expect(hits).toEqual(allowed ? [collider.handle] : []);
                }
            }
            expect(
                world.castRay(ray, 10, true, undefined, {
                    memberships: 0,
                    filter: mask,
                }),
            ).toBeNull();
            const groups = {memberships: filter, filter: mask};
            expect(
                world.castRay(ray, 10, true, undefined, groups, collider),
            ).toBeNull();
            expect(
                world.castRay(
                    ray,
                    10,
                    true,
                    undefined,
                    groups,
                    undefined,
                    undefined,
                    () => false,
                ),
            ).toBeNull();
        },
    );

    test("character movement queries retain full-width category filters", () => {
        world.createCollider(
            ColliderDesc.ball(0.5)
                .setTranslation(2, 0, 0)
                .setCollisionGroups32(1 << 31, 1 << 16),
        );
        const body = world.createRigidBody(
            RigidBodyDesc.kinematicPositionBased(),
        );
        const collider = world.createCollider(
            ColliderDesc.ball(0.2).setCollisionGroups32(1 << 16, 1 << 31),
            body,
        );
        const controller = world.createCharacterController(0.01);
        try {
            world.step();
            controller.computeColliderMovement(
                collider,
                {x: 4, y: 0, z: 0},
                undefined,
                {memberships: 1 << 16, filter: 1 << 31},
            );
            expect(controller.computedMovement().x).toBeLessThan(2);
            controller.computeColliderMovement(
                collider,
                {x: 4, y: 0, z: 0},
                undefined,
                {memberships: 1 << 16, filter: 0},
            );
            expect(controller.computedMovement().x).toBeCloseTo(4);
        } finally {
            world.removeCharacterController(controller);
        }
    });

    test("vehicle wheel queries use separate high membership and filter bits", () => {
        world.createCollider(
            ColliderDesc.cuboid(4, 0.1, 4)
                .setTranslation(0, -0.1, 0)
                .setCollisionGroups32(1 << 31, 1 << 16),
        );
        const chassis = world.createRigidBody(
            RigidBodyDesc.dynamic().setCanSleep(false).setTranslation(0, 1, 0),
        );
        world.createCollider(ColliderDesc.ball(0.1), chassis);
        const vehicle = world.createVehicleController(chassis);
        try {
            vehicle.addWheel(
                {x: 0, y: 0, z: 0},
                {x: 0, y: -1, z: 0},
                {x: 1, y: 0, z: 0},
                1,
                0.2,
            );
            world.step();
            vehicle.updateVehicle(world.timestep, undefined, {
                memberships: 1 << 16,
                filter: 1 << 31,
            });
            expect(vehicle.wheelIsInContact(0)).toBe(true);
            vehicle.updateVehicle(world.timestep, undefined, {
                memberships: 1 << 16,
                filter: 0,
            });
            expect(vehicle.wheelIsInContact(0)).toBe(false);
        } finally {
            world.removeVehicleController(vehicle);
        }
    });

    test.each([false, true])(
        "joint warm-start flag reaches native parameters and keeps motors finite through updates/teleports (%s)",
        (warmstart) => {
            const params = world.integrationParameters;
            const settings = () => [
                params.dt,
                params.numSolverIterations,
                params.numInternalPgsIterations,
                params.contact_erp,
                params.normalizedAllowedLinearError,
                params.normalizedPredictionDistance,
            ];
            const defaults = settings();
            expect(params.warmstartJoints).toBe(false);
            params.warmstartJoints = warmstart;
            expect(params.raw.warmstartJoints).toBe(warmstart);
            const parent = world.createRigidBody(RigidBodyDesc.fixed());
            const child = world.createRigidBody(
                RigidBodyDesc.dynamic().setCanSleep(false),
            );
            world.createCollider(ColliderDesc.ball(0.25), child);
            const joint = world.createImpulseJoint(
                JointData.revolute(
                    {x: 0, y: 0, z: 0},
                    {x: 0, y: 0, z: 0},
                    {x: 0, y: 0, z: 1},
                ),
                parent,
                child,
                true,
            ) as RevoluteImpulseJoint;
            joint.setContactsEnabled(false);
            joint.configureMotorModel(MotorModel.AccelerationBased);
            const bend = () => {
                const p = parent.rotation();
                const c = child.rotation();
                // Independent relative twist for this deliberately Z-only test world.
                return (
                    2 * Math.atan2(p.w * c.z - p.z * c.w, p.w * c.w + p.z * c.z)
                );
            };
            const step = (count: number) => {
                for (let i = 0; i < count; i += 1) {
                    world.step();
                    const rotation = child.rotation();
                    for (const vector of [
                        child.translation(),
                        child.linvel(),
                        child.angvel(),
                        rotation,
                    ]) {
                        expect(
                            Number.isFinite(vector.x) &&
                                Number.isFinite(vector.y) &&
                                Number.isFinite(vector.z),
                        ).toBe(true);
                    }
                    expect(Number.isFinite(rotation.w)).toBe(true);
                }
            };
            for (const target of [0.7, -0.9, 1.2]) {
                joint.configureMotorPosition(target, 1000, 60);
                step(180);
                expect(Math.abs(bend() - target)).toBeLessThan(0.05);
            }
            for (let i = 0; i < 24; i += 1) {
                joint.configureMotorPosition(
                    i % 2 === 0 ? -0.8 : 0.8,
                    1000,
                    60,
                );
                step(4);
            }
            const position = {x: 2, y: -3, z: 1};
            parent.setTranslation(position, true);
            parent.setRotation(
                {x: 0, y: 0, z: Math.sin(0.35 / 2), w: Math.cos(0.35 / 2)},
                true,
            );
            child.setTranslation(position, true);
            child.setRotation(
                {x: 0, y: 0, z: Math.sin(-0.5 / 2), w: Math.cos(-0.5 / 2)},
                true,
            );
            child.setLinvel({x: 0, y: 0, z: 0}, true);
            child.setAngvel({x: 0, y: 0, z: 0}, true);
            joint.configureMotorPosition(0.6, 1000, 60);
            step(240);
            expect(Math.abs(bend() - 0.6)).toBeLessThan(0.05);
            expect(child.translation().x).toBeCloseTo(position.x, 2);
            expect(child.translation().y).toBeCloseTo(position.y, 2);
            expect(child.translation().z).toBeCloseTo(position.z, 2);
            expect(settings()).toEqual(defaults);
            params.warmstartJoints = !warmstart;
            expect(params.raw.warmstartJoints).toBe(!warmstart);
            joint.configureMotorPosition(-0.4, 1000, 60);
            step(180);
            expect(Math.abs(bend() + 0.4)).toBeLessThan(0.05);
            expect(settings()).toEqual(defaults);
        },
    );

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
