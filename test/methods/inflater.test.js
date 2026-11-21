"use strict";
const { expect } = require("chai");
const Zip = require("../../adm-zip");
const zlib = require("zlib");
const Inflater = require("../../methods/inflater");

const version = +process.versions.node.split(".")[0];

describe("method - inflater output cap", () => {
    const payload = Buffer.from("x".repeat(64));
    const deflated = zlib.deflateRawSync(payload);
    const emptyDeflated = zlib.deflateRawSync(Buffer.alloc(0));

    describe("inflate (sync)", () => {
        it("returns data within the declared size", () => {
            expect(new Inflater(deflated, payload.length).inflate().equals(payload)).to.equal(true);
        });

        it("still inflates an empty entry declared as size 0", () => {
            expect(new Inflater(emptyDeflated, 0).inflate().length).to.equal(0);
        });

        it("rejects output past a declared size of 0", function () {
            if (version < 15) this.skip(); // maxOutputLength needs Node >= 15
            expect(() => new Inflater(deflated, 0).inflate()).to.throw();
        });
    });

    describe("inflateAsync", () => {
        it("returns data within the declared size", (done) => {
            new Inflater(deflated, payload.length).inflateAsync((buf, err) => {
                expect(err).to.equal(undefined);
                expect(buf.equals(payload)).to.equal(true);
                done();
            });
        });

        it("still inflates an empty entry declared as size 0", (done) => {
            new Inflater(emptyDeflated, 0).inflateAsync((buf, err) => {
                expect(err).to.equal(undefined);
                expect(buf.length).to.equal(0);
                done();
            });
        });

        it("rejects output past a declared size of 0", (done) => {
            let calls = 0;
            new Inflater(deflated, 0).inflateAsync((buf, err) => {
                calls++;
                expect(calls).to.equal(1);
                expect(buf.length).to.equal(0);
                expect(String(err && err.message)).to.match(/exceeds the declared uncompressed size/);
                done();
            });
        });

        it("rejects output past a declared non-zero size", (done) => {
            new Inflater(deflated, 10).inflateAsync((buf, err) => {
                expect(buf.length).to.equal(0);
                expect(String(err && err.message)).to.match(/exceeds the declared uncompressed size/);
                done();
            });
        });
    });
});

// a DEFLATE block header with BFINAL=1 and the reserved block type 3, which zlib rejects
const badDeflate = Buffer.from([0x07, 0x00, 0x00, 0x00]);

function zipWithBadDeflate() {
    const zip = new Zip();
    zip.addFile("a.txt", Buffer.alloc(1000, "a"));
    const buf = zip.toBuffer();
    expect(buf.readUInt16LE(8)).to.equal(8); // deflated
    const dataStart = 30 + buf.readUInt16LE(26) + buf.readUInt16LE(28);
    badDeflate.copy(buf, dataStart);
    return new Zip(buf);
}

describe("method - inflater async errors", () => {
    it("inflateAsync passes a zlib error to the callback", (done) => {
        new Inflater(badDeflate, 10).inflateAsync(function (result, err) {
            expect(err).to.be.an("error");
            expect(result.length).to.equal(0);
            done();
        });
    });

    it("inflateAsync calls the callback only once", (done) => {
        let calls = 0;
        new Inflater(badDeflate, 10).inflateAsync(function () {
            calls++;
        });
        setTimeout(() => {
            expect(calls).to.equal(1);
            done();
        }, 50);
    });

    it("inflateAsync still returns valid data", (done) => {
        const input = Buffer.alloc(100, "b");
        const raw = require("zlib").deflateRawSync(input);
        new Inflater(raw, input.length).inflateAsync(function (result, err) {
            expect(err).to.equal(undefined);
            expect(result.equals(input)).to.equal(true);
            done();
        });
    });

    it("readFileAsync reports malformed DEFLATE data as an error", (done) => {
        const zip = zipWithBadDeflate();
        zip.readFileAsync("a.txt", function (data, err) {
            expect(err).to.be.an("error");
            expect(data.length).to.equal(0);
            done();
        });
    });

    it("readAsTextAsync reports malformed DEFLATE data as an error", (done) => {
        const zip = zipWithBadDeflate();
        zip.readAsTextAsync("a.txt", function (data, err) {
            expect(err).to.be.an("error");
            done();
        });
    });
});
