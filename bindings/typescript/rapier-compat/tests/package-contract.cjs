// Parent tester runs this after regenerating the 3D package. No repository writes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {createRequire} = require("node:module");
const {execFileSync} = require("node:child_process");
const ts = require("typescript");

function assertSphericalMotorContract(R) {
    const half = 0.4;
    const rotations = [
        {x: Math.sin(half), y: 0, z: 0, w: Math.cos(half)},
        {x: 0, y: -Math.sin(half), z: 0, w: Math.cos(half)},
        {x: 0, y: 0, z: Math.sin(half), w: Math.cos(half)},
        {x: 0.3, y: -0.4, z: 0.5, w: Math.sqrt(0.5)},
    ];
    for (const rotation of rotations) {
        const world = new R.World({x: 0, y: 0, z: 0});
        try {
            const parent = world.createRigidBody(R.RigidBodyDesc.fixed());
            const child = world.createRigidBody(
                R.RigidBodyDesc.dynamic().setCanSleep(false).setRotation(rotation),
            );
            world.createCollider(R.ColliderDesc.ball(0.2), child);
            const anchor = {x: 0, y: 0, z: 0};
            const joint = world.createImpulseJoint(
                R.JointData.spherical(anchor, anchor), parent, child, true,
            );
            assert(joint instanceof R.SphericalImpulseJoint);
            assert.equal(joint.type(), R.JointType.Spherical);
            assert.equal(world.impulseJoints.len(), 1);
            assert.equal(typeof joint.configureMotorModel, "function");
            assert.equal(typeof joint.configureMotorPosition, "function");
            for (const axis of [R.JointAxis.AngX, R.JointAxis.AngY, R.JointAxis.AngZ]) {
                joint.configureMotorModel(axis, R.MotorModel.AccelerationBased);
                joint.configureMotorPosition(axis, 0, 200, 2 * Math.sqrt(200));
            }
            // Starting off target on each axis proves all three native motors work.
            for (let i = 0; i < 600; i += 1) world.step();
            const q = child.rotation();
            assert(Math.hypot(q.x, q.y, q.z) < 0.001, "spherical motors must reach identity");
            assert(Math.abs(Math.abs(q.w) - 1) < 0.001);
            const v = child.angvel();
            assert(Math.hypot(v.x, v.y, v.z) < 0.005, "spherical motors must settle");
        } finally {
            world.free();
        }
    }
}

async function main() {
    const pkg = path.resolve(__dirname, "../builds/3d/pkg");
    const artifacts = fs.mkdtempSync(
        path.join(os.tmpdir(), "rapier-chargeuk-package-"),
    );
    const run = (command, args, options = {}) =>
        execFileSync(command, args, {
            encoding: "utf8",
            ...options,
        });
    const [dry] = JSON.parse(
        run("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
            cwd: pkg,
        }),
    );
    const [pack] = JSON.parse(
        run(
            "npm",
            [
                "pack",
                "--json",
                "--ignore-scripts",
                "--pack-destination",
                artifacts,
            ],
            {cwd: pkg},
        ),
    );
    assert.equal(pack.name, "@chargeuk/rapier3d-compat");
    assert.equal(pack.version, "0.21.0-chargeuk.3");
    assert.equal(pack.integrity, dry.integrity);
    for (const file of [
        "package.json",
        "LICENSE",
        "README.md",
        "dist/rapier.cjs",
        "dist/rapier.mjs",
        "dist/rapier.d.ts",
        "dist/raw.d.ts",
        "dist/rapier_wasm3d.d.ts",
        "dist/rapier_wasm3d_bg.wasm",
        "web/rapier.mjs",
        "web/rapier.d.ts",
        "web/init.d.ts",
        "web/raw.d.ts",
        "web/rapier_wasm3d.d.ts",
        "web/rapier_wasm3d_bg.wasm",
    ]) {
        assert(
            pack.files.some((entry) => entry.path === file),
            `missing packed file: ${file}`,
        );
    }
    const installed = path.join(
        artifacts,
        "node_modules/@chargeuk/rapier3d-compat",
    );
    fs.mkdirSync(installed, {recursive: true});
    run("tar", [
        "-xzf",
        path.join(artifacts, pack.filename),
        "--strip-components=1",
        "-C",
        installed,
    ]);
    const rawDeclarations = fs.readFileSync(
        path.join(installed, "dist/rapier_wasm3d.d.ts"),
        "utf8",
    );
    assert.doesNotMatch(rawDeclarations, /\[Symbol\.dispose\]/);
    assert.match(rawDeclarations, /^[ \t]*free\(\): void;[ \t]*$/m);
    const manifest = JSON.parse(
        fs.readFileSync(path.join(installed, "package.json"), "utf8"),
    );
    assert.equal(
        manifest.repository.url,
        "git+https://github.com/Chargeuk/rapier.git",
    );
    assert.equal(manifest.license, "Apache-2.0");
    assert.equal(manifest.publishConfig.access, "public");
    assert.equal(manifest.private, undefined);
    assert.deepEqual(manifest.exports["."], {
        types: "./dist/rapier.d.ts",
        require: "./dist/rapier.cjs",
        import: "./dist/rapier.mjs",
    });
    assert.deepEqual(manifest.exports["./web"], {
        types: "./web/rapier.d.ts",
        import: "./web/rapier.mjs",
        default: "./web/rapier.mjs",
    });
    for (const key of [
        "dependencies",
        "optionalDependencies",
        "peerDependencies",
    ]) {
        assert.equal(
            Object.keys(manifest[key] || {}).length,
            0,
            "package must be self-contained",
        );
    }
    const webDeclarations = fs.readFileSync(
        path.join(installed, "web/rapier_wasm3d.d.ts"),
        "utf8",
    );
    assert.doesNotMatch(webDeclarations, /\[Symbol\.dispose\]/);
    // Node resolves the actual packed exports from an isolated consumer.
    const requireConsumer = createRequire(path.join(artifacts, "consumer.cjs"));
    const cjs = requireConsumer("@chargeuk/rapier3d-compat");
    const cjsInitialization = cjs.init();
    assert.equal(cjs.init(), cjsInitialization);
    await cjsInitialization;
    assert.equal(cjs.version(), "0.21.0"); // Internal binding version is unchanged.
    assertSphericalMotorContract(cjs);
    for (const name of [
        "World",
        "ColliderDesc",
        "Collider",
        "JointData",
        "RevoluteImpulseJoint",
    ]) {
        assert.equal(typeof cjs[name], "function", `missing export: ${name}`);
    }
    const world = new cjs.World({x: 0, y: 0, z: 0});
    try {
        const collider = world.createCollider(
            cjs.ColliderDesc.ball(1).setBelongsToGrouping(7),
        );
        collider.setDetailedCollisionGroups(0xffff_ffff, 1, 2, 7);
        world.step();
    } finally {
        world.free();
    }
    fs.writeFileSync(
        path.join(artifacts, "consumer.mjs"),
        `
        import assert from 'node:assert/strict';
        import * as R from '@chargeuk/rapier3d-compat';
        import Web from '@chargeuk/rapier3d-compat/web';
        import {readFileSync} from 'node:fs';
        import {createRequire} from 'node:module';
        import {pathToFileURL} from 'node:url';
        const first = R.init();
        assert.equal(R.init(), first);
        await first;
        assert.equal(R.version(), '0.21.0');
        const webPath = createRequire(import.meta.url).resolve('@chargeuk/rapier3d-compat/web');
        await Web.init(readFileSync(new URL('./rapier_wasm3d_bg.wasm', pathToFileURL(webPath))));
        assert.equal(Web.version(), R.version());
        const webModule = await import('@chargeuk/rapier3d-compat/web');
        assert.equal(Web.World, webModule.World);
        assert.deepEqual(Object.keys(Web).sort(), Object.keys(R.default).sort());
        ${assertSphericalMotorContract.toString()}
        assertSphericalMotorContract(R);
        assertSphericalMotorContract(Web);
        const world = new R.World({x: 0, y: 0, z: 0});
        try {
            const collider = world.createCollider(R.ColliderDesc.ball(1).setBelongsToGrouping(7));
            collider.setDetailedCollisionGroups(0xffffffff, 1, 2, 7);
            world.step();
        } finally { world.free(); }
    `,
    );
    run(process.execPath, [path.join(artifacts, "consumer.mjs")]);
    run(process.execPath, [
        path.join(__dirname, "web-package-loading.cjs"),
        installed,
    ]);
    const fixture = path.join(artifacts, "consumer.ts");
    fs.copyFileSync(path.join(__dirname, "package-types.ts"), fixture);
    const webFixture = path.join(artifacts, "consumer-web.ts");
    fs.copyFileSync(path.join(__dirname, "package-web-types.ts"), webFixture);
    const program = ts.createProgram([fixture, webFixture], {
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2020,
        // Match the upstream/compat tsconfig's ESM + node resolution with locked TS 4.8.
        module: ts.ModuleKind.ES2020,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        types: [],
    });
    const errors = ts.getPreEmitDiagnostics(program);
    assert.equal(
        errors.length,
        0,
        ts.formatDiagnosticsWithColorAndContext(errors.slice(0, 10), {
            getCanonicalFileName: (file) => file,
            getCurrentDirectory: () => artifacts,
            getNewLine: () => "\n",
        }),
    );
    console.log(
        JSON.stringify({
            status: "PASS",
            name: pack.name,
            version: pack.version,
            files: pack.files.length,
            tarballBytes: pack.size,
            unpackedBytes: pack.unpackedSize,
            wasmBytes: fs.statSync(
                path.join(installed, "dist/rapier_wasm3d_bg.wasm"),
            ).size,
            checks: [
                "pack-dry-run",
                "tarball",
                "CJS",
                "ESM",
                "spherical-wrapper-and-three-axis-motors-CJS-ESM-web",
                "web-loading",
                "TypeScript-root-and-web",
            ],
            artifacts,
        }),
    );
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
