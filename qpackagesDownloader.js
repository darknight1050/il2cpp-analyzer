
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
    await axios.get(baseUrl)
        .then(res => {
            const downloadedPackages = getDownloadedPackages();
            const packages = res.data;
            console.log(packages);
            for(let package of packages) {
                const downloadedPackage = downloadedPackages.find(downloadedPackage => downloadedPackage.name == package);
                axios.get(baseUrl + package + "?limit=0")
                    .then(res => {
                        const versions = res.data;
                        for(let version of versions) {
                            if(!downloadedPackage || !downloadedPackage.versions.includes(version.version)) {
                                axios.get(baseUrl + package + "/" + version.version)
                                    .then(res => {
                                        const additionalData = res.data?.config?.info?.additionalData;
                                        if(additionalData &&!additionalData.headersOnly && !additionalData.staticLinking) {
                                            const debugSoLink = additionalData.debugSoLink;
                                            if(debugSoLink) {
                                                axios.get(debugSoLink, { responseType: "stream" })
                                                    .then(res => {
                                                        if (!fs.existsSync(versionsPath + "/" + package))
                                                            fs.mkdirSync(versionsPath + "/" + package);
                                                        const writer = fs.createWriteStream(versionsPath + "/" + package + "/" + version.version + ".so", res.data);
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
                                                                    console.log("Downloaded " + package + " version " + version.version);
                                                                    resolve(true);
                                                                } else {
                                                                    console.log("Error downloading " + package + " version " + version.version + ": " + error);
                                                                }
                                                            });
                                                        });
                                                    })
                                                    .catch(e => {
                                                        console.log(debugSoLink + ": Error: ", e.message);
                                                    });
                                            }
                                        }
                                    })
                                    .catch(e => {
                                        console.log(baseUrl + package + "/" + version.version + ": Error: ", e.message);
                                    }); 
                            }
                        }
                    })
                    .catch(e => {
                        console.log(baseUrl + package + "?limit=0" + ": Error: ", e.message);
                    });
            }
        })
        .catch(e => {
            console.log(baseUrl + ": Error: ", e.message);
        });
}

module.exports = { downloadPackages };