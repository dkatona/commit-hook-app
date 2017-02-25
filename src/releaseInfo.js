'use strict';

var fs = require('fs');
var logger = require('./setup/logSetup').logger;

function ReleaseInfo(masterVersion, releaseVersion, hotfixVersion) {
    this.masterVersion = masterVersion;
    this.releaseVersion = releaseVersion;
    this.hotfixVersion = hotfixVersion;
}

ReleaseInfo.prototype.getFixVersion = function(branch) {
    if (branch === "master") {
        return this.masterVersion;
    } else if (branch.startsWith("release")) {
        return this.releaseVersion;
    } else {
        //TODO hotfix to be implemented
        return null;
    }
};

function validateReleaseInfo(req,callback) {
    req.checkBody("masterVersion", "Fix version for master can't be empty").notEmpty();
    req.checkBody("releaseVersion", "Fix version for release can't be empty").notEmpty();
    req.checkBody("hotfixVersion", "Fix version for hotfix can't be empty").notEmpty();

    req.getValidationResult().then(callback);
}

function fromRequest(req) {
    var releaseInfo = req.body;
    return new ReleaseInfo(releaseInfo.masterVersion, releaseInfo.releaseVersion, releaseInfo.hotfixVersion);
}

function loadFromFile(filePath) {
    try {
        logger.debug("action=load_release_info status=START");
        var json = fs.readFileSync(filePath);
        var releaseInfo = JSON.parse(json);
        logger.debug("action=load_release_info status=FINISH releaseInfo=%s", json);

        return new ReleaseInfo(releaseInfo.masterVersion, releaseInfo.releaseVersion, releaseInfo.hotfixVersion);
    } catch(e) {
        logger.error("action=load_release_info status=ERROR filePath=%s error=%s", filePath, e);
        return null;
    }
}

function storeToFile(filePath, releaseInfo) {
    try {
        logger.debug("action=store_release_info status=START");
        fs.writeFileSync(filePath, JSON.stringify(releaseInfo));
        logger.debug("action=store_release_info status=FINISH releaseInfo=%s", releaseInfo);
        return true;
    } catch(e) {
        logger.error("action=store_release_info status=ERROR releaseInfo=%s error=%s", releaseInfo, error);
        return false;
    }
}

module.exports = {
    ReleaseInfo: ReleaseInfo,
    validateReleaseInfo: validateReleaseInfo,
    loadFromFile : loadFromFile,
    storeToFile: storeToFile,
    fromRequest: fromRequest
}
