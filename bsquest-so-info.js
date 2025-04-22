const fs = require("fs"),
    axios = require("axios");

const versionsPath = "./versions/bsquest";
const url = "https://mods.bsquest.xyz/so-info.json";

const availableBuildIDs = {};

const updateCache = async () => {
    if (!fs.existsSync(versionsPath)) fs.mkdirSync(versionsPath);
    const buildIDs = await axios
        .get(url)
        .then((res) => res.data)
        .catch((e) => {
            console.log(url + ": Error: " + e.message);
        });
    if (buildIDs) {
        for (let buildID of Object.keys(buildIDs)) {
            for (let url of Object.keys(buildIDs[buildID])) {
                let so = buildIDs[buildID][url];
                if (!so.stripped && so.debug) {
                    availableBuildIDs[buildID.toLocaleLowerCase()] = url;
                }
            }
        }
    }
};

const downloadIfExists = async (buildID) => {
    const url = availableBuildIDs[buildID];
    if (url) {
        const path = versionsPath + "/" + buildID + ".so";
        await axios
            .get(url, { responseType: "stream" })
            .then((res) => {
                const writer = fs.createWriteStream(path, res.data);
                return new Promise((resolve, reject) => {
                    res.data.pipe(writer);
                    let error = null;
                    writer.on("error", (err) => {
                        error = err;
                        writer.close();
                        reject(err);
                    });
                    writer.on("close", () => {
                        if (!error) {
                            console.log(
                                "Downloaded buildID " + buildID + " from " + url
                            );
                            resolve(true);
                        } else {
                            console.log(
                                "Error downloading buildID " +
                                    buildID +
                                    " from " +
                                    url +
                                    ": " +
                                    error
                            );
                        }
                    });
                });
            })
            .catch((e) => {
                console.log(url + ": Error: " + e.message);
                console.log("Writing empty buildID " + buildID);
                fs.writeFileSync(path, "");
            });
        return path;
    }
    return undefined;
};

module.exports = { updateCache, downloadIfExists };
