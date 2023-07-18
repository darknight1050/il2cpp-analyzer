let { loadVersions, getBeatsaberVersionFromStacktrace, splitStacktrace } = require("../analyzer");
const fs = require('fs/promises');

// Set up the versions (this needs to run faster)
beforeAll(async () => {
    await loadVersions();
}, 10000);


test('Parsing stacktrace 1', async () => {
    {
        let file = await fs.readFile(__dirname + '/stacktraces/stacktrace1.txt');
        let version = getBeatsaberVersionFromStacktrace(file.toString());
        expect(version).toBe(undefined);
    }
});

test('Parsing stacktrace 2', async () => {
    {
        let file = await fs.readFile(__dirname + '/stacktraces/stacktrace2.txt');
        let version = getBeatsaberVersionFromStacktrace(file.toString());
        expect(version).toBe("1.25.1");
    }
});


test('Splitting stacktraces', async () => {
    {
        {
            let file = await fs.readFile(__dirname + '/stacktraces/stacktrace1.txt');
            const analyzed = splitStacktrace(file.toString());
            expect(analyzed.stack).toBe(undefined);
            expect(analyzed.backtrace).toContain("prop_area::find_property");
            expect(analyzed.header).toContain("Version '");
            expect(analyzed.registers).toContain("pc");
            expect(analyzed.registers).not.toContain("/lib/arm64/");
        }
        {
            let file = await fs.readFile(__dirname + '/stacktraces/stacktrace2.txt');
            const analyzed = splitStacktrace(file.toString());
            expect(analyzed.stack).toBe(undefined);
            expect(analyzed.backtrace).toContain("Hook_LivenessState_TraverseGCDescriptor");
            expect(analyzed.header).toContain("Version '");
            expect(analyzed.registers).toContain("pc");
            expect(analyzed.registers).not.toContain("/lib/arm64/");

        }
        {
            let file = await fs.readFile(__dirname + '/stacktraces/stacktrace3.txt');
            const analyzed = splitStacktrace(file.toString());
            expect(analyzed.stack).not.toBe(undefined);
            expect(analyzed.backtrace).toContain("Hook_LivenessState_TraverseGCDescriptor");
            expect(analyzed.header).toContain("Version '");
            expect(analyzed.registers).toContain("pc");
            expect(analyzed.registers).not.toContain("/lib/arm64/");
        }

        // Stacktrace with no backtrace
        {
            let file = await fs.readFile(__dirname + '/stacktraces/stacktrace4.txt');
            const analyzed = splitStacktrace(file.toString());
            expect(analyzed.stack).not.toBe(undefined);
            expect(analyzed.backtrace).toBe(undefined);
            expect(analyzed.header).toContain("Version '");
            expect(analyzed.registers).toContain("pc");
            expect(analyzed.registers).not.toContain("/lib/arm64/");
        }
        // Stacktrace with no backtrace
        {
            let file = await fs.readFile(__dirname + '/stacktraces/stacktrace5.txt');
            const analyzed = splitStacktrace(file.toString());
            expect(analyzed.stack).toBe(undefined);
            expect(analyzed.backtrace).toBe(undefined);
            expect(analyzed.header).toContain("Version '");
            expect(analyzed.registers).toContain("pc");
            expect(analyzed.registers).not.toContain("/lib/arm64/");
        }
    }
});