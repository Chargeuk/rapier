// Copied into the packed-package consumer by package-contract.cjs.
import {
    ColliderDesc,
    GenericImpulseJoint,
    init,
    InteractionGroups32,
    JointAxesMask,
    JointAxis,
    JointData,
    MotorModel,
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
        world.integrationParameters.contactClustering = false;
        world.integrationParameters.contactRecycling = true;
        world.integrationParameters.normalizedContactRecycleDistance = 0.0125;
        const contactClustering: boolean =
            world.integrationParameters.contactClustering;
        const contactRecycling: boolean =
            world.integrationParameters.contactRecycling;
        const recycleDistance: number =
            world.integrationParameters.normalizedContactRecycleDistance;
        const rawClustering: boolean =
            world.integrationParameters.raw.contactClustering;
        const rawRecycling: boolean =
            world.integrationParameters.raw.contactRecycling;
        const rawRecycleDistance: number =
            world.integrationParameters.raw.normalizedContactRecycleDistance;
        // @ts-expect-error Contact flags require booleans.
        world.integrationParameters.contactClustering = 1;
        // @ts-expect-error Contact flags require booleans.
        world.integrationParameters.contactRecycling = 0;
        // @ts-expect-error Normalized distance requires a number.
        world.integrationParameters.normalizedContactRecycleDistance = "0.05";
        void [
            contactClustering,
            contactRecycling,
            recycleDistance,
            rawClustering,
            rawRecycling,
            rawRecycleDistance,
        ];
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
        const generic = world.createImpulseJoint(
            JointData.generic(
                anchor,
                anchor,
                {x: 1, y: 0, z: 0},
                0 as JointAxesMask,
            ),
            body1,
            body2,
            true,
        ) as GenericImpulseJoint;
        for (const axis of [
            JointAxis.LinX,
            JointAxis.LinY,
            JointAxis.LinZ,
            JointAxis.AngX,
            JointAxis.AngY,
            JointAxis.AngZ,
        ]) {
            const modelResult: void = generic.configureMotorModel(
                axis,
                MotorModel.AccelerationBased,
            );
            const velocityResult: void = generic.configureMotorVelocity(
                axis,
                0.2,
                12,
            );
            const positionResult: void = generic.configureMotorPosition(
                axis,
                0.3,
                100,
                20,
            );
            const combinedResult: void = generic.configureMotor(
                axis,
                0.3,
                0.2,
                100,
                20,
            );
            const forceResult: void = generic.setMotorMaxForce(axis, 5);
            void [
                modelResult,
                velocityResult,
                positionResult,
                combinedResult,
                forceResult,
            ];
        }
        // @ts-expect-error Joint axes are typed enum values, not names.
        generic.configureMotorPosition("LinX", 0, 100, 20);
        // @ts-expect-error Each model configuration requires an axis and a model.
        generic.configureMotorModel(MotorModel.AccelerationBased);
        // @ts-expect-error The force/torque cap is numeric.
        generic.setMotorMaxForce(JointAxis.LinX, "5");
        world.step();
    } finally {
        world.free();
    }
}

void consumer;
