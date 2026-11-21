"use strict";

// CVE-2026-76845: extraction must not write through a symlink that already
// exists inside the target directory. Each test makes target/link point to a
// sibling "outside" directory and extracts an entry named link/file.txt.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const Zip = require("../../adm-zip");

let symlinkSupported = true;
let base;

function makeZip() {
    const zip = new Zip();
    zip.addFile("link/", Buffer.alloc(0));
    zip.addFile("link/file.txt", Buffer.from("content"));
    return new Zip(zip.toBuffer());
}

try {
    const probe = fs.mkdtempSync(path.join(os.tmpdir(), "admzip-probe-"));
    fs.symlinkSync(probe, path.join(probe, "l"), "dir");
    fs.rmSync(probe, { recursive: true, force: true });
} catch (e) {
    symlinkSupported = false;
}

(symlinkSupported ? describe : describe.skip)("ADM-ZIP - extraction through a symlink inside the target", () => {
    let target, outside;

    beforeEach(() => {
        base = fs.mkdtempSync(path.join(os.tmpdir(), "admzip-symlink-"));
        target = path.join(base, "target");
        outside = path.join(base, "outside");
        fs.mkdirSync(target);
        fs.mkdirSync(outside);
        fs.symlinkSync(outside, path.join(target, "link"), "dir");
    });

    afterEach(() => fs.rmSync(base, { recursive: true, force: true }));

    it("extractAllTo refuses to write through the symlink", () => {
        assert.throws(() => makeZip().extractAllTo(target, true));
        assert.strictEqual(fs.existsSync(path.join(outside, "file.txt")), false);
    });

    it("extractEntryTo refuses to write through the symlink", () => {
        assert.throws(() => makeZip().extractEntryTo("link/file.txt", target, true, true));
        assert.strictEqual(fs.existsSync(path.join(outside, "file.txt")), false);
    });

    it("extractEntryTo of a directory refuses to write its children through the symlink", () => {
        assert.throws(() => makeZip().extractEntryTo("link/", target, true, true));
        assert.strictEqual(fs.existsSync(path.join(outside, "file.txt")), false);
    });

    it("extractAllToAsync reports an error and does not write through the symlink", async () => {
        await assert.rejects(makeZip().extractAllToAsync(target, true));
        assert.strictEqual(fs.existsSync(path.join(outside, "file.txt")), false);
    });

    it("still extracts into a target that is itself reached through a symlink", () => {
        const viaLink = path.join(base, "via");
        fs.symlinkSync(outside, viaLink, "dir");
        makeZip().extractAllTo(viaLink, true);
        assert.strictEqual(fs.readFileSync(path.join(outside, "link", "file.txt"), "utf8"), "content");
    });
});
