// Copied into the packed-package consumer by package-contract.cjs.
import {
    ColliderDesc,
    init,
    InteractionGroups32,
    JointData,
    RevoluteImpulseJoint,
    RigidBodyDesc,
    World,
} from "@chargeuk/rapier3d-compat";

async function consumer() {
    await init();
    const world = new World({x: 0, y: 0, z: 0});
    try {
        const desc: ColliderDesc = ColliderDesc.capsule(0.5, 0.2)
            .setBelongsToWithGrouping(1)
            .setCollidesWithWithGrouping(2)
            .setBelongsToGrouping(7);
        desc.belongsToWithGrouping = 1;
        desc.collidesWithWithGrouping = 2;
        desc.belongsToGrouping = 7;
        const collider = world.createCollider(desc);
        collider.setDetailedCollisionGroups(0xffff_ffff, 1, 2, 7);
        collider.setCollisionGroups(0xffff_ffff);
        collider.setSolverGroups(0);
        const memberships = 0x8000_0000;
        const filter = 0x4001_8000;
        desc.setCollisionGroups32(memberships, filter);
        desc.setSolverGroups32(filter, memberships);
        desc.setDetailedCollisionGroups32(
            memberships,
            filter,
            1 << 31,
            1 << 30,
            7,
        );
        desc.collisionMemberships = memberships;
        desc.collisionFilter = filter;
        desc.solverMemberships = filter;
        desc.solverFilter = memberships;
        collider.setCollisionGroups32(memberships, filter);
        collider.setDetailedCollisionGroups32(
            memberships,
            filter,
            1 << 31,
            1 << 30,
            7,
        );
        collider.setSolverGroups32(filter, memberships);
        const groups: InteractionGroups32 = collider.collisionGroups32();
        const solver: InteractionGroups32 = collider.solverGroups32();
        const custom: number[] = [
            collider.belongsToWithGrouping(),
            collider.collidesWithWithGrouping(),
            collider.belongsToGrouping(),
        ];
        void solver;
        void custom;
        world.projectPoint({x: 0, y: 0, z: 0}, true, undefined, groups);
        world.integrationParameters.warmstartJoints = true;
        const warmstart: boolean = world.integrationParameters.warmstartJoints;
        void warmstart;
        collider.setRadius(0.4);
        collider.setHalfHeight(1);
        const body1 = world.createRigidBody(RigidBodyDesc.fixed());
        const body2 = world.createRigidBody(RigidBodyDesc.dynamic());
        const anchor = {x: 0, y: 0, z: 0};
        const data = JointData.revolute(anchor, anchor, {x: 1, y: 0, z: 0});
        data.limitsEnabled = true;
        data.limits = [-0.4, 0.7];
        const joint = world.createImpulseJoint(
            data,
            body1,
            body2,
            true,
        ) as RevoluteImpulseJoint;
        joint.setAnchor1(anchor);
        joint.setAnchor2(anchor);
        joint.setLimits(-0.2, 0.3);
        JointData.revoluteWithAxes(
            anchor,
            anchor,
            {x: 1, y: 0, z: 0},
            {x: 0, y: 1, z: 0},
        );
        world.step();
    } finally {
        world.free();
    }
}

void consumer;
