// Run by the tester against a generated package, or the extracted archive path.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const {pathToFileURL} = require("node:url");
const test = require("node:test");

const pkg = path.resolve(
    process.argv[2] || path.join(__dirname, "../builds/3d/pkg"),
);
const moduleUrl = pathToFileURL(path.join(pkg, "web/rapier.mjs")).href;
const wasmUrl = pathToFileURL(path.join(pkg, "web/rapier_wasm3d_bg.wasm")).href;
const wasmPath = path.join(pkg, "web/rapier_wasm3d_bg.wasm");

// Fresh processes keep each load/error scenario independent of the singleton.
function consumer(body) {
    execFileSync(
        process.execPath,
        [
            "--input-type=module",
            "--eval",
            `
        import assert from "node:assert/strict";
        import fs from "node:fs";
        import * as R from ${JSON.stringify(moduleUrl)};
        const bytes = fs.readFileSync(${JSON.stringify(wasmPath)});
        const expectedUrl = ${JSON.stringify(wasmUrl)};
        const originalCompileStreaming = WebAssembly.compileStreaming;
        const originalInstantiate = WebAssembly.instantiate;
        let fetches = 0, streams = 0, instantiations = 0;
        const rapierInstances = new Set();
        const sentinel = new TypeError("original failure");
        WebAssembly.compileStreaming = async (...args) => {
            streams++;
            return originalCompileStreaming(...args);
        };
        WebAssembly.instantiate = async (...args) => {
            instantiations++;
            const result = await originalInstantiate(...args);
            const instance = result instanceof WebAssembly.Instance ? result : result.instance;
            if (
                typeof instance.exports.rawrigidbodyset_new === "function" &&
                typeof instance.exports.rawintegrationparameters_new === "function"
            ) rapierInstances.add(instance);
            return result;
        };
        globalThis.fetch = async (url) => {
            fetches++;
            assert.equal(String(url), expectedUrl);
            return new Response(bytes, {headers: {"Content-Type": "application/wasm"}});
        };
        const failure = async (promise) => {
            try { await promise; assert.fail("expected initialization rejection"); }
            catch (error) { return error; }
        };
        ${body}
    `,
        ],
        {stdio: "pipe"},
    );
}

test("web archive uses exactly the compat binary and has no embedded WASM", () => {
    assert.deepEqual(
        fs.readFileSync(wasmPath),
        fs.readFileSync(path.join(pkg, "dist/rapier_wasm3d_bg.wasm")),
    );
    const bundle = fs.readFileSync(path.join(pkg, "web/rapier.mjs"), "utf8");
    assert.match(bundle, /import\.meta\.url/);
    assert.doesNotMatch(bundle, /<deleted>/);
    assert(
        !bundle.includes(
            fs.readFileSync(wasmPath).toString("base64").slice(0, 128),
        ),
        "web bundle embeds the engine binary",
    );
});

test("cold and cached imports share initialization, classes and the emitted asset URL", () => {
    consumer(`
        const dynamic = await import(${JSON.stringify(moduleUrl)});
        assert.equal(dynamic, R);
        assert.equal(R.default.World, R.World);
        assert.equal(R.default.init, R.init);
        const first = R.init();
        assert.equal(dynamic.init(), first);
        // The first caller owns the input, even while initialization is pending.
        assert.equal(R.init(new Uint8Array()), first);
        await first;
        assert.equal(R.init(), first);
        await R.init();
        assert.equal(fetches, 1);
        assert.equal(streams, 1);
        assert.equal(rapierInstances.size, 1);
        assert.equal(R.version(), "0.21.0");
        const world = new dynamic.World({x: 0, y: 0, z: 0});
        try {
            const collider = world.createCollider(R.ColliderDesc.ball(1).setBelongsToGrouping(7));
            collider.setDetailedCollisionGroups(0xffffffff, 1, 2, 7);
            world.step();
        } finally { world.free(); }
    `);
});

test("wrong MIME uses buffered initialization for a valid binary", () => {
    consumer(`
        globalThis.fetch = async () => { fetches++; return new Response(bytes, {headers: {"Content-Type": "application/octet-stream"}}); };
        const first = R.init();
        assert.equal(R.init(), first);
        await first;
        assert.equal(R.init(), first);
        await R.init();
        assert.equal(fetches, 1);
        assert.equal(streams, 0);
        assert.equal(rapierInstances.size, 1);
        assert.equal(R.version(), "0.21.0");
    `);
});

test("noncanonical MIME parameters use the supported buffer fallback", () => {
    consumer(`
        globalThis.fetch = async () => { fetches++; return new Response(bytes, {headers: {"Content-Type": "application/wasm; charset=utf-8"}}); };
        const first = R.init();
        assert.equal(R.init(), first);
        await first;
        assert.equal(R.init(), first);
        await R.init();
        assert.equal(fetches, 1);
        assert.equal(streams, 0);
        assert.equal(rapierInstances.size, 1);
    `);
});

test("unavailable streaming uses buffered initialization", () => {
    consumer(`
        WebAssembly.compileStreaming = undefined;
        const first = R.init();
        assert.equal(R.init(), first);
        await first;
        assert.equal(R.init(), first);
        await R.init();
        assert.equal(fetches, 1);
        assert.equal(streams, 0);
        assert.equal(rapierInstances.size, 1);
        assert.equal(R.version(), "0.21.0");
    `);
});

test("unrelated WASM instances do not count as Rapier engine initialization", () => {
    consumer(`
        const empty = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
        await WebAssembly.instantiate(empty);
        assert.equal(instantiations, 1);
        assert.equal(rapierInstances.size, 0);
        const first = R.init(bytes);
        assert.equal(R.init(), first);
        await first;
        assert.equal(rapierInstances.size, 1);
        const attempts = instantiations;
        await WebAssembly.instantiate(await WebAssembly.compile(empty));
        assert.equal(instantiations, attempts + 1);
        assert.equal(R.init(), first);
        await R.init();
        assert.equal(rapierInstances.size, 1);
        assert.equal(fetches, 0);
    `);
});

test("HTTP failures reject once without including response URLs or status text", () => {
    consumer(`
        globalThis.fetch = async () => {
            fetches++;
            const response = new Response("missing", {status: 404, statusText: "secret-token"});
            Object.defineProperty(response, "url", {value: "https://user:secret@example.test/missing?token=secret"});
            return response;
        };
        const first = R.init();
        const error = await failure(first);
        assert.equal(error.message, "Failed to fetch Rapier WASM (HTTP 404).");
        assert.equal(R.init(), first);
        assert.equal(await failure(R.init()), error);
        assert.equal(fetches, 1);
        assert.equal(streams, 0);
        assert.equal(instantiations, 0);
    `);
});

test("fetch rejection is preserved without retry or arbitrary fallback", () => {
    consumer(`
        globalThis.fetch = async () => { fetches++; throw sentinel; };
        const first = R.init();
        assert.equal(await failure(first), sentinel);
        assert.equal(await failure(R.init()), sentinel);
        assert.equal(fetches, 1);
        assert.equal(instantiations, 0);
    `);
});

test("streaming errors retain identity and never fall back to instantiate", () => {
    consumer(`
        WebAssembly.compileStreaming = async () => { streams++; throw sentinel; };
        assert.equal(await failure(R.init()), sentinel);
        assert.equal(streams, 1);
        assert.equal(instantiations, 0);
    `);
});

for (const mime of ["application/wasm", "text/html"]) {
    test(`invalid binary rejects with CompileError for ${mime}`, () => {
        consumer(`
            globalThis.fetch = async () => new Response("not wasm", {headers: {"Content-Type": ${JSON.stringify(
                mime,
            )}}});
            const first = R.init();
            const error = await failure(first);
            assert(error instanceof WebAssembly.CompileError);
            assert.equal(await failure(R.init()), error);
        `);
    });
}

test("explicit bytes and compiled modules initialize the same web classes without fetching", () => {
    for (const input of ["bytes", "await WebAssembly.compile(bytes)"]) {
        consumer(`
            const first = R.init(Promise.resolve(${input}));
            assert.equal(R.init(), first);
            await first;
            assert.equal(fetches, 0);
            assert.equal(rapierInstances.size, 1);
            assert.equal(R.version(), "0.21.0");
            const world = new R.World({x: 0, y: 0, z: 0});
            world.step(); world.free();
        `);
    }
});

test("link errors and explicit-input rejection remain the original errors", () => {
    consumer(`
        const linkError = new WebAssembly.LinkError("original link failure");
        let linkAttempts = 0;
        WebAssembly.instantiate = async (...args) => {
            instantiations++;
            if (args[0] === bytes) {
                linkAttempts++;
                throw linkError;
            }
            return originalInstantiate(...args);
        };
        const unrelated = await WebAssembly.instantiate(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
        assert(unrelated.instance instanceof WebAssembly.Instance);
        assert.equal(linkAttempts, 0);
        const first = R.init(bytes);
        assert.equal(R.init(), first);
        assert.equal(await failure(first), linkError);
        assert.equal(R.init(bytes), first);
        assert.equal(await failure(R.init()), linkError);
        assert.equal(linkAttempts, 1);
        assert.equal(fetches, 0);
    `);
    consumer(`
        assert.equal(await failure(R.init(Promise.reject(sentinel))), sentinel);
        assert.equal(fetches, 0);
        assert.equal(instantiations, 0);
    `);
});
