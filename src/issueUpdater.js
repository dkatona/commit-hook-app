'use strict';

var _ = require('underscore');
var jiraClient = require('./jiraClient');
var RepositoryPush = require('./repositoryPush');

var config = require('config');
var repositoryMapping = config.get("RepositoryMapping");

var releaseInfo = require('./releaseInfo');
const RELEASE_INFO_FILE = "./config/releaseInfo.json";
var currentReleaseInfo = releaseInfo.loadFromFile(RELEASE_INFO_FILE);

var logger = require('./setup/logSetup').logger;
var app = require('./setup/expressSetup').app;

app.post('/releaseInfo', function (req, res) {
    releaseInfo.validateReleaseInfo(req, function (result) {
        if (!result.isEmpty()) {
            logger.error("New release info invalid, releaseInfo=%s", req.body);
            res.status(400).send('There have been validation errors: ' + JSON.stringify(result.array()));
        } else {
            logger.info("action=set_release_info status=START");
            var newReleaseInfo = releaseInfo.fromRequest(req);
            currentReleaseInfo = newReleaseInfo;
            var passed = releaseInfo.storeToFile(RELEASE_INFO_FILE, newReleaseInfo);
            passed ? res.status(204).end() : res.status(500).send("Error writing release info to a file!");

            logger.info("action=set_release_info status=%s releaseInfo=%s",
                passed ? "FINISH" : "ERROR", JSON.stringify(newReleaseInfo));

        }
    });
});

app.get('/releaseInfo', function (req, res) {
    res.send(JSON.stringify(currentReleaseInfo));
});

app.post('/repositoryPush', function (req, res) {
    var repositoryPush = new RepositoryPush(req.body);

    var issueKeys = repositoryPush.issueKeys;
    var repository = repositoryPush.repository;
    var branch = repositoryPush.branchName;

    logger.info("action=process_commit status=START issueKeys=%s, repository=%s, branch=%s",
        issueKeys, repository, branch);
    if (!issueKeys) {
        logger.error("action=process_commit status=ERROR reason=issueKeys_empty commitMessage='%s'", repositoryPush.commitMessage);
        res.status(400).json({"error": "issueKeys are empty - bad commit message"});
    } else {
        var componentName = repositoryMapping.get(repository);
        if (!componentName) {
            logger.warn("No component defined for repository=%s", repository);
        }
        var fixVersion = currentReleaseInfo.getFixVersion(branch);
        if (!fixVersion) {
            logger.warn("No fix version defined for branch=%s, current releaseInfo=", branch, currentReleaseInfo);
        }

        jiraClient.getIssuesWithParents(issueKeys, function (error, issues) {
            if (error) {
                logger.error("action=process_commit status=ERROR issueKeys=%s error=%s", issueKeys,
                        JSON.stringify(error));
                res.status(500).json({"error": JSON.stringify(error)});
            } else {
                jiraClient.updateIssues(issues, componentName, fixVersion, function (error, result) {
                    if (error) {
                        logger.error("action=process_commit status=ERROR issueKeys=%s error=%s result=%s", issueKeys,
                            JSON.stringify(error), JSON.stringify(result));
                        res.status(500).send(JSON.stringify(error));
                    } else {
                        logger.info("action=process_commit status=FINISH issueKeys=%s", issueKeys);
                        res.status(204).end();
                    }
                });
            }
        });
    }
});

var server = app.listen(process.env.PORT || 8080, function () {
    logger.info("action=commit_hook_app status=READY port=%d", server.address().port)
});

process.on('SIGINT', function() {
    logger.info("action=commit_hook_app status=STOP");
    process.exit();
});