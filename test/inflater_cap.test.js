"use strict";

const { expect } = require("chai");
const Zip = require("../adm-zip");

const REAL_SIZE = 1024 * 1024;
const version = +process.versions.node.split(".")[0];

// One DEFLATED entry of REAL_SIZE bytes whose declared uncompressed size, in
// both the local and the central header, is rewritten to `declaredSize`.
function zipWithDeclaredSize(declaredSize) {
    const zip = new Zip();
    zip.addFile("d.bin", Buffer.alloc(REAL_SIZE, 0x41));
    const raw = Buffer.from(zip.toBuffer());
    raw.writeUInt32LE(declaredSize, 22);
    const cen = raw.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    raw.writeUInt32LE(declaredSize, cen + 24);
    return raw;
}

function readAsync(raw) {
    return new Promise((resolve) => {
        new Zip(raw).getEntries()[0].getDataAsync((data, err) => resolve({ data, err }));
    });
}

describe("decompression size cap (async path and declared size 0)", () => {
    it("getDataAsync stops at a declared size smaller than the real data", async () => {
        const { data, err } = await readAsync(zipWithDeclaredSize(16));
        expect(err, "an error must be reported").to.exist;
        expect(data.length).to.be.below(REAL_SIZE);
    });

    it("getDataAsync stops when the declared size is 0", async () => {
        const { data, err } = await readAsync(zipWithDeclaredSize(0));
        expect(err, "an error must be reported").to.exist;
        expect(data.length).to.be.below(REAL_SIZE);
    });

    it("getData caps inflation when the declared size is 0", function () {
        if (version < 15) this.skip(); // maxOutputLength needs Node >= 15
        const entry = new Zip(zipWithDeclaredSize(0)).getEntries()[0];
        expect(() => entry.getData()).to.throw(RangeError);
    });

    it("getDataAsync still reads a legitimate DEFLATED entry", async () => {
        const { data, err } = await readAsync(zipWithDeclaredSize(REAL_SIZE));
        expect(err).to.not.exist;
        expect(data.equals(Buffer.alloc(REAL_SIZE, 0x41))).to.equal(true);
    });

    it("getDataAsync still reads an empty DEFLATED entry", async () => {
        const zip = new Zip();
        zip.addFile("e.bin", Buffer.alloc(0));
        const entry = new Zip(zip.toBuffer()).getEntries()[0];
        const { data, err } = await new Promise((resolve) => entry.getDataAsync((data, err) => resolve({ data, err })));
        expect(err).to.not.exist;
        expect(data.length).to.equal(0);
    });
});
