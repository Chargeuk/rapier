// Copied into the packed-package consumer by package-contract.cjs.
import {
    ColliderDesc,
    init,
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
