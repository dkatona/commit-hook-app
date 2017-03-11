'use strict';

var _ = require('underscore');
var jiraClient = require('./jiraClient');
var RepositoryPush = require('./repositoryPush');

var config = require('config');
var repositoryMapping = config.get("RepositoryMapping");
var branchRegex = config.get("BranchRegex");

var releaseInfo = require('./releaseInfo');
const RELEASE_INFO_FILE = "./config/releaseInfo.json";
var currentReleaseInfo = releaseInfo.loadFromFile(RELEASE_INFO_FILE);

var logger = require('./setup/logSetup').logger;
var app = require('./setup/expressSetup').app;

app.post('/releaseInfo', function (req, res) {
    releaseInfo.validateReleaseInfo(req, function (result) {
        if (!result.isEmpty()) {
            logger.error("New release info invalid, releaseInfo=%s", JSON.stringify(req.body));
            res.status(400).send('There have been validation errors: ' + JSON.stringify(result.array()));
            return;
        }
        logger.info("action=set_release_info status=START");
        var newReleaseInfo = releaseInfo.fromRequest(req);
        currentReleaseInfo = newReleaseInfo;
        var passed = releaseInfo.storeToFile(RELEASE_INFO_FILE, newReleaseInfo);
        passed ? res.status(204).end() : res.status(500).send("Error writing release info to a file!");

        logger.info("action=set_release_info status=%s releaseInfo=%s",
                    passed ? "FINISH" : "ERROR", JSON.stringify(newReleaseInfo));

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

    if (!shouldBeProcessed(repositoryPush, res)) {
        return;
    }

    logger.info("action=process_commit status=START issueKeys=%s, repository=%s, branch=%s",
                issueKeys, repository, branch);
    if (!issueKeys) {
        logger.info("action=process_commit status=ERROR reason=issueKeys_empty commitMessage='%s'",
                     repositoryPush.commitMessage);
        res.status(200).json({"status": "issueKeys are empty - bad commit message"});
        return;
    }
    var componentName = repositoryMapping.has(repository) ? repositoryMapping.get(repository) : null;
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
            return;
        }
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
    });

});

function shouldBeProcessed(repositoryPush, res) {
    var branch = repositoryPush.branchName;
    var branchMatched = branchRegex.some(function (regex) {
        return branch.match(regex);
    });
    if (!branchMatched) {
        logger.info("Branch %s does not match branch regexes=%s, skipping...", branch, branchRegex);
        res.status(200).json({"status" : "Not processed, branch=" + branch +
                                         " does not match branch regex whitelist=" + branchRegex});
        return false;
    }
    var commitMessage = repositoryPush.commitMessage;
    if (commitMessage.indexOf("Revert") !== -1) {
        logger.info("Commit is a revert, commit message=%s, skipping...",commitMessage);
        res.status(200).json({"status" : "Not processed, commit is a revert"});
        return false;
    }
    return true;
}

var server = app.listen(process.env.PORT || 8080, function () {
    logger.info("action=commit_hook_app status=READY port=%d", server.address().port)
});

process.on('SIGINT', function() {
    logger.info("action=commit_hook_app status=STOP");
    process.exit();
});