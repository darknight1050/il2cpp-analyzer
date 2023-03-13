
const fs = require("fs"),
    fsPath = require("path"),
    axios = require("axios");

const versionsPath = "./versions/qpackages";
const baseUrl = "https://qpackages.com/";

const readPackage = (path, packageName) => {
    const package = {name: packageName, versions: []};
    const packagePath = path + "/" + packageName;
    let files = fs.readdirSync(packagePath, { withFileTypes: true });
    
    for (let file of files) {
        if (file.isFile()) {
            package.versions.push(fsPath.basename(file.name, fsPath.extname(file.name)));
        }
    }
    return package;
}

const readVersionsDir = (path) => {
    const packages = [];
    let files = fs.readdirSync(path, { withFileTypes: true });
    for (let file of files) {
        if (file.isDirectory())
            packages.push(readPackage(path, file.name));
    }
    return packages;
}

const getDownloadedPackages = () => {
    return readVersionsDir(versionsPath);
}

const downloadPackages = async () => {
    const newFiles = [];
    const downloadedPackages = getDownloadedPackages();
    const packages = await axios.get(baseUrl)
        .then(res => res.data)
        .catch(e => {
            console.log(baseUrl + ": Error: " + e.message);
        });
    if(packages) {
        //console.log("Got packages");
        //console.log(packages);
        for(let package of packages) {
            const downloadedPackage = downloadedPackages.find(downloadedPackage => downloadedPackage.name == package);
            const versions = await axios.get(baseUrl + package + "?limit=0")
                .then(res => res.data)
                .catch(e => {
                    console.log(baseUrl + package + "?limit=0" + ": Error: " + e.message);
                });
            if(versions) {
                //console.log("Got versions for " + package);
                for(let version of versions) {
                    if(!downloadedPackage || !downloadedPackage.versions.includes(version.version)) {
                        //console.log("Version " + version.version + " for " + package + " not downloaded yet");
                        if (!fs.existsSync(versionsPath + "/" + package))
                            fs.mkdirSync(versionsPath + "/" + package);
                        const path = versionsPath + "/" + package + "/" + version.version + ".so";
                        const additionalData = await axios.get(baseUrl + package + "/" + version.version)
                            .then(res => res.data?.config?.info?.additionalData)
                            .catch(e => {
                                console.log(baseUrl + package + "/" + version.version + ": Error: ", e.message);
                            }); 
                        if(additionalData) {
                            //console.log("Got version " + version.version + " for " + package);
                            const debugSoLink = additionalData.debugSoLink;
                            if(!additionalData.staticLinking && debugSoLink) {
                                await axios.get(debugSoLink, { responseType: "stream" })
                                    .then(res => {
                                        const writer = fs.createWriteStream(path, res.data);
                                        return new Promise((resolve, reject) => {
                                            res.data.pipe(writer);
                                            let error = null;
                                            writer.on("error", err => {
                                                error = err;
                                                writer.close();
                                                reject(err);
                                            });
                                            writer.on("close", () => {
                                                if (!error) {
                                                    newFiles.push(path);
                                                    console.log("Downloaded version " + version.version + " for " + package);
                                                    resolve(true);
                                                } else {
                                                    console.log("Error downloading version " + version.version + " for " + package + ": " + error);
                                                }
                                            });
                                        });
                                    })
                                    .catch(e => {
                                        console.log(debugSoLink + ": Error: " + e.message);
                                        console.log("Writing empty version " + version.version + " for " + package);
                                                    fs.writeFileSync(path, "");
                                    });
                            } else {
                                console.log("Writing empty version " + version.version + " for " + package);
                                fs.writeFileSync(path, "");
                            }
                        } else {
                            console.log("Couldn't get version " + version.version + " for " + package);
                        }
                    }
                }
            } else {
                console.log("Couldn't get versions for " + package);
            }
        }
    } else {
        console.log("Couldn't get packages");
    }
    return newFiles;
}

module.exports = { downloadPackages };