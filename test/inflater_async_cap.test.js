"use strict";
const { expect } = require("chai");
const zlib = require("zlib");
const Inflater = require("../methods/inflater");
const Zip = require("../adm-zip");

const CAP_MESSAGE = "ADM-ZIP: Decompressed data exceeds the declared uncompressed size";

// Runs inflateAsync and waits a little after the first callback, to also see a second one.
function inflateAsync(compressed, expectedLength) {
    return new Promise((resolve) => {
        const calls = [];
        Inflater(compressed, expectedLength).inflateAsync((result, err) => {
            calls.push({ result, err });
            if (calls.length === 1) setTimeout(() => resolve(calls), 50);
        });
    });
}

describe("method - inflater async output cap - CVE-2026-114103", () => {
    const plain = Buffer.alloc(1024 * 1024, 0x61);
    const compressed = zlib.deflateRawSync(plain);

    it("stops with an error when the output exceeds the expected length", async () => {
        const calls = await inflateAsync(compressed, 1024);
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].err).to.be.an("error");
        expect(calls[0].err.message).to.equal(CAP_MESSAGE);
        expect(calls[0].result).to.have.lengthOf(0);
    });

    it("stops with an error when the expected length is 0 but data inflates to more", async () => {
        const calls = await inflateAsync(compressed, 0);
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].err).to.be.an("error");
        expect(calls[0].err.message).to.equal(CAP_MESSAGE);
    });

    it("returns the data when the output matches the expected length", async () => {
        const calls = await inflateAsync(compressed, plain.length);
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].err).to.equal(undefined);
        expect(calls[0].result.equals(plain)).to.equal(true);
    });

    it("returns an empty buffer for empty data with expected length 0", async () => {
        const calls = await inflateAsync(zlib.deflateRawSync(Buffer.alloc(0)), 0);
        expect(calls).to.have.lengthOf(1);
        expect(calls[0].err).to.equal(undefined);
        expect(calls[0].result).to.have.lengthOf(0);
    });

    it("still reads a legitimate DEFLATED entry asynchronously", (done) => {
        const zip = new Zip();
        zip.addFile("a.txt", plain);
        const entry = new Zip(zip.toBuffer()).getEntry("a.txt");
        entry.getDataAsync((data, err) => {
            expect(err).to.equal(undefined);
            expect(data.equals(plain)).to.equal(true);
            done();
        });
    });
});
