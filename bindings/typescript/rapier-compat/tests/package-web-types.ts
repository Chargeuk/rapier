import RAPIER, {init, World, ColliderDesc} from "@chargeuk/rapier3d-compat/web";

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
world.step();
world.free();
void [
    initialization,
    bytesInitialization,
    responseInitialization,
    urlInitialization,
];
