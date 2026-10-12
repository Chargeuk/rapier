import RAPIER, {
    init,
    World,
    ColliderDesc,
    GenericImpulseJoint,
    JointAxesMask,
    JointAxis,
    JointData,
    MotorModel,
    RigidBodyDesc,
} from "@chargeuk/rapier3d-compat/web";

const initialization: Promise<void> = init();
const bytesInitialization: Promise<void> = init(new Uint8Array(8));
const responseInitialization: Promise<void> = init(
    Promise.resolve(new Response()),
);
const urlInitialization: Promise<void> = init(
    new URL("https://example.test/rapier.wasm"),
);
const world: World = new RAPIER.World({x: 0, y: 0, z: 0});
const collider = world.createCollider(
    ColliderDesc.ball(1).setBelongsToGrouping(7),
);
collider.setDetailedCollisionGroups(0xffff_ffff, 1, 2, 7);
world.integrationParameters.contactClustering = false;
world.integrationParameters.contactRecycling = true;
world.integrationParameters.normalizedContactRecycleDistance = 0.0125;
const contactClustering: boolean =
    world.integrationParameters.contactClustering;
const contactRecycling: boolean = world.integrationParameters.contactRecycling;
const recycleDistance: number =
    world.integrationParameters.normalizedContactRecycleDistance;
const rawClustering: boolean =
    world.integrationParameters.raw.contactClustering;
const rawRecycling: boolean = world.integrationParameters.raw.contactRecycling;
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
const anchor = {x: 0, y: 0, z: 0};
const target = world.createRigidBody(RigidBodyDesc.kinematicPositionBased());
const body = world.createRigidBody(RigidBodyDesc.dynamic());
const generic = world.createImpulseJoint(
    JointData.generic(anchor, anchor, {x: 1, y: 0, z: 0}, 0 as JointAxesMask),
    target,
    body,
    true,
) as GenericImpulseJoint;
const defaultExportClass: typeof GenericImpulseJoint =
    RAPIER.GenericImpulseJoint;
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
        MotorModel.ForceBased,
    );
    const velocityResult: void = generic.configureMotorVelocity(axis, 0.2, 12);
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
generic.configureMotorVelocity("LinZ", 0.2, 12);
// @ts-expect-error Combined configuration requires both targets and both gains.
generic.configureMotor(JointAxis.LinX, 0, 100, 20);
// @ts-expect-error The force/torque cap is numeric.
generic.setMotorMaxForce(JointAxis.AngZ, "5");
void defaultExportClass;
world.step();
world.free();
void [
    initialization,
    bytesInitialization,
    responseInitialization,
    urlInitialization,
];
