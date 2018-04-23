'use strict';

const RELEASE_INFO_DIR = "./config/";
var glob = require("glob");
var releaseInfoRegex = /.*releaseInfo-*(.*)\.json/;
var logger = require('./setup/logSetup').logger;


var releaseInfo = require('./releaseInfo');
var releaseInfos = {};

function ReleaseManager(defaultReleaseInfoProject){
    this.defaultReleaseInfoProject = defaultReleaseInfoProject;
}

ReleaseManager.prototype.validateReleaseInfo = function(req, callback) {
    var jiraKey = req.params.jiraKey;
    var releaseProject = jiraKey ? jiraKey : this.defaultReleaseInfoProject;

    req.checkBody("developmentVersion", "Fix version for development is empty or non-existent").notEmpty()
        .releaseVersionExists(releaseProject);
    req.checkBody("releaseVersion", "Fix version for release is empty or non-existent").notEmpty()
        .releaseVersionExists(releaseProject);

    req.getValidationResult().then(callback);
};

ReleaseManager.prototype.reloadReleaseInfo = function(callback) {
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
};

ReleaseManager.prototype.getReleaseInfo = function(jiraProjectKey) {
    if (!jiraProjectKey) {
        return releaseInfos.default;
    }
    return releaseInfos[jiraProjectKey] ? releaseInfos[jiraProjectKey] : releaseInfos.default;
};

ReleaseManager.prototype.updateReleaseInfo = function(newReleaseInfo, jiraProjectKey) {

    var fileName = jiraProjectKey ? "releaseInfo-" + jiraProjectKey + ".json" : "releaseInfo.json";
    var passed = releaseInfo.storeToFile(RELEASE_INFO_DIR + fileName, newReleaseInfo);
    if (passed) {
        if (!jiraProjectKey) {
            releaseInfos.default = newReleaseInfo;
        } else {
            releaseInfos[jiraProjectKey] = newReleaseInfo;
        }
    }
    return passed;
};

module.exports = ReleaseManager;
