let { loadVersions, getBeatsaberVersionFromStacktrace } = require("../analyzer");
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