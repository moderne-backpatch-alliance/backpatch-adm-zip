"use strict";

const { expect } = require("chai");
const Zip = require("../../adm-zip");

// Builds an archive with two entries, then renames the second one to the first
// one's name in both its local and central header (names have equal length).
function archiveWithDuplicateNames() {
    const zip = new Zip();
    zip.addFile("first.txt", Buffer.from("first content"));
    zip.addFile("other.txt", Buffer.from("other content"));
    const buf = zip.toBuffer();
    const from = Buffer.from("other.txt");
    const to = Buffer.from("first.txt");
    let pos = buf.indexOf(from);
    let count = 0;
    while (pos !== -1) {
        to.copy(buf, pos);
        count++;
        pos = buf.indexOf(from, pos + from.length);
    }
    expect(count).to.equal(2);
    return buf;
}

describe("duplicate entry names (CVE-2026-114104)", () => {
    it("rejects an archive whose central directory names one entry twice", () => {
        const buf = archiveWithDuplicateNames();
        expect(() => new Zip(buf).getEntries()).to.throw(/Duplicate entry name "first\.txt"/);
    });

    it("rejects it when entries are read eagerly", () => {
        const buf = archiveWithDuplicateNames();
        expect(() => new Zip(buf, { readEntries: true })).to.throw(/Duplicate entry name/);
    });

    it("still reads an archive with distinct entry names", () => {
        const zip = new Zip();
        zip.addFile("first.txt", Buffer.from("first content"));
        zip.addFile("other.txt", Buffer.from("other content"));
        const read = new Zip(zip.toBuffer());
        expect(read.getEntries().map((e) => e.entryName)).to.deep.equal(["first.txt", "other.txt"]);
        expect(read.readAsText("other.txt")).to.equal("other content");
    });
});
