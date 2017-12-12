// -*- javascript -*-
import * as Schism from './rt/rt';

import child_process from 'child_process';
import fs from 'fs';
import util from 'util';

export const OPTIONS = {
    use_snapshot: true, // load schism-stage0.wasm if true instead of
                         // building with host scheme

    // which stages to build and run tests for
    stage0: true,
    stage1: false,
    stage2: false,
    stage3: false, // compile-only, no point running tests
}

// Returns the contents of out.wasm
export async function compileWithHostScheme(name) {
    const { stdout, stderr } = await util.promisify(child_process.exec)(`./schism.ss ${name}`);

    return util.promisify(fs.readFile)('out.wasm');
}

// Uses host scheme to compile schism and returns the wasm bytes
async function compileBootstrap() {
    return compileWithHostScheme('./schism/compiler.ss');
}

function make_compiler(compiler_bytes) {
    return async function(bytes) {
	const engine = new Schism.Engine;
	const schism = await engine.loadWasmModule(await compiler_bytes);
	engine.setCurrentInputPort(bytes);
	schism.exports['compile-stdin->stdout']();
	return new Uint8Array(engine.output_data);
    }
}

// The stage0 bytes, either loaded from a snapshot
// (schism-stage0.wasm) or compiled by the host Scheme.
export const stage0_bytes = OPTIONS.stage0 ? (async function() {
    return OPTIONS.use_snapshot
	? fs.readFileSync('schism-stage0.wasm')
	: await compileBootstrap()
})() : undefined;
// Compile bytes using the stage0 compiler.
export const stage0_compile = OPTIONS.stage0 ? make_compiler(stage0_bytes) : undefined;
export const stage1_bytes = OPTIONS.stage1 ? stage0_compile(fs.readFileSync('./schism/compiler.ss'))
                                    : undefined;
if (OPTIONS.stage1) {
  stage1_bytes.then((bytes) => {
    fs.writeFileSync('schism-stage1.wasm', bytes);
  });
}

export const stage1_compile = OPTIONS.stage1 ? make_compiler(stage1_bytes) : undefined;
export const stage2_bytes = OPTIONS.stage2 ? stage1_compile(fs.readFileSync('./schism/compiler.ss'))
                                    : undefined;
export const stage2_compile = OPTIONS.stage2 ? make_compiler(stage2_bytes) : undefined;
export const stage3_bytes = OPTIONS.stage3 ? stage2_compile(fs.readFileSync('./schism/compiler.ss'))
                                    : undefined;
