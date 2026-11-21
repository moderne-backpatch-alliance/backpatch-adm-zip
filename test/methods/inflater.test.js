"use strict";
const { expect } = require("chai");
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
