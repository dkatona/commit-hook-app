'use strict';

const RELEASE_INFO_DIR = "./config/";
var glob = require("glob");
var releaseInfoRegex = /.*releaseInfo-*(.*)\.json/;
var logger = require('./setup/logSetup').logger;


var releaseInfo = require('./releaseInfo');
var releaseInfos = {};

function validateReleaseInfo(req,callback) {
    req.checkBody("developmentVersion", "Fix version for development can't be empty").notEmpty();
    req.checkBody("releaseVersion", "Fix version for release can't be empty").notEmpty();

    req.getValidationResult().then(callback);
}

function reloadReleaseInfo(callback) {
    glob("./config/releaseInfo*.json", function(err, files) {
        if (err) {
            logger.error("Error reloading releaseInfo configuration!", err);
            callback(err);
        }
        files.forEach(function(file) {
            logger.info("Loading configuration from " + file);
            var releaseInfoObject = releaseInfo.loadFromFile(file);
            var jiraProjectKey = releaseInfoRegex.exec(file)[1];
            if (jiraProjectKey) {
                releaseInfos[jiraProjectKey] = releaseInfoObject;
            } else {
                releaseInfos.default = releaseInfoObject;
            }
        });
        logger.info("Configuration " + JSON.stringify(releaseInfos));
        callback();
    });
}

function getReleaseInfo(jiraProjectKey) {
    if (!jiraProjectKey) {
        return releaseInfos.default;
    }
    return releaseInfos[jiraProjectKey] !== null ? releaseInfos[jiraProjectKey] : releaseInfos.default;
}

function updateReleaseInfo(newReleaseInfo, jiraProjectKey) {

    var fileName = jiraProjectKey ? "releaseInfo-" + jiraProjectKey + ".json" : "releaseInfo.json";
    var passed = releaseInfo.storeToFile(RELEASE_INFO_DIR + fileName, newReleaseInfo);
    if (passed) {
        releaseInfos[jiraProjectKey] = newReleaseInfo;
    }
    return passed;
}

module.exports = {
    validateReleaseInfo: validateReleaseInfo,
    reloadReleaseInfo: reloadReleaseInfo,
    getReleaseInfo: getReleaseInfo,
    updateReleaseInfo: updateReleaseInfo
}