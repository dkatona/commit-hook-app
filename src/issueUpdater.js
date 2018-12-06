'use strict';

var _ = require('underscore');
var fs = require('fs');
var querystring = require('querystring');
var jiraClient = require('./jiraClient');
var RepositoryPush = require('./repositoryPush');
var config = require('config');
var repositoryMapping = config.get("RepositoryMapping");
var useCamelCaseComponentName = config.get("UseCamelCaseComponent");
var defaultReleaseInfoProject = config.get("DefaultReleaseInfoProject");
var ignoreComponentRepositories = config.get("IgnoreComponentRepositories");
var branchRegex = config.get("BranchRegex");

const upperCamelCase = require('uppercamelcase');

var ReleaseInfoManager = require('./releaseInfoManager');
var releaseInfoManager = new ReleaseInfoManager(defaultReleaseInfoProject);
var releaseInfo = require('./releaseInfo');

var logger = require('./setup/logSetup').logger;
var expressSetup = require('./setup/expressSetup');
expressSetup.configureValidation(jiraClient);

var app = expressSetup.app;

function verificationReleasedInfo(oldData, newData) {
    let errors = [];
    if ('releasedTimestamp' in newData) {
        errors[errors.length] = "Error: Impossible to change releasedTimestamp attribute directly.";
    }
    if ('releasedVersion' in newData) {
        if (!RegExp(/^R\d{2}-\d{2}$/).test(newData.releasedVersion)) {
            errors[errors.length] = "Error: the releasedVersion '"+newData.releasedVersion+"' is in the wrong format (Ex. R19-01)";
        }
        newData.releasedTimestamp = (new Date()).getTime()
    }
    return errors;
}

function processReleasedInfo(req, res) {
    let fileName = "./config/releasedInfo.json";
    let releasedInfoObject = {};
    if (req.method == 'GET') {
        try {
            releasedInfoObject = fs.readFileSync(fileName);
            res.send(releasedInfoObject);
        } catch(e) {
            res.status(500)
            logger.error("The problem with loading JSON config file "+ fileName);
        }
    } else if (req.method == 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        }).on('end',() => {
            try {
                let changes = null
                try {
                    // Input is JSON
                    changes = JSON.parse(body);
                } catch(ex) {
                    // Input is standard POST
                    changes = querystring.parse(body);
                }
                if (fs.existsSync(fileName)) {
                    releasedInfoObject = JSON.parse(fs.readFileSync(fileName));
                }
                let errors = verificationReleasedInfo(releasedInfoObject, changes)
                if (errors.length == 0) {
                    releasedInfoObject = Object.assign({}, releasedInfoObject, changes);
                    fs.writeFile(fileName, JSON.stringify(releasedInfoObject, null, " "), function(err) {
                        if (err) throw err;
                        logger.info("Update configuration: " + body);
                        res.end('ok');
                    });
                } else {
                    res.send(errors.join("\n"));
                    logger.error(errors.join("\n"));
                    throw Error("Validation failed.");
                }
            } catch(e) {
               res.status(500).end('faild');
               logger.error("The problem with updating JSON config file "+ fileName);
            }
        })
    }
}

app.get('/releasedInfo', function (req, res) {
    processReleasedInfo(req, res)
});

app.post('/releasedInfo', function (req, res) {
    processReleasedInfo(req, res)
});

app.post('/releaseInfo', function (req, res) {
    processReleaseInfo(req,res);
});

app.post('/releaseInfo/:jiraKey', function (req, res) {
    processReleaseInfo(req,res);
});

function processReleaseInfo(req, res) {
    releaseInfoManager.validateReleaseInfo(req, function (result) {
        if (!result.isEmpty()) {
            logger.error("New release info invalid, releaseInfo=%s", JSON.stringify(req.body));
            res.status(400).send('There have been validation errors: ' + JSON.stringify(result.array()));
            return;
        }
        var jiraKey = req.params.jiraKey;

        logger.info("action=set_release_info status=START jiraKey=%s", jiraKey ? jiraKey : "DEFAULT");
        var newReleaseInfo = releaseInfo.fromRequest(req);
        var passed = releaseInfoManager.updateReleaseInfo(newReleaseInfo, jiraKey);

        passed ? res.status(204).end() : res.status(500).send("Error writing release info to a file!");
        logger.info("action=set_release_info jiraKey=%s status=%s releaseInfo=%s",
                    jiraKey ? jiraKey : "DEFAULT",
                    passed ? "FINISH" : "ERROR",
                    JSON.stringify(newReleaseInfo));
    });
}

app.get('/releaseInfo', function (req, res) {
    var releaseInfo = releaseInfoManager.getReleaseInfo();
    res.send(JSON.stringify(releaseInfo));
});

app.get('/releaseInfo/:jiraKey', function (req, res) {
    var releaseInfo = releaseInfoManager.getReleaseInfo(req.params.jiraKey);
    res.send(JSON.stringify(releaseInfo));
});

app.post('/repositoryPush', function (req, res) {
    var repositoryPush = new RepositoryPush(req.body);

    var issueKeys = repositoryPush.issueKeys;
    var jiraProjectKey = repositoryPush.jiraProjectKey;
    var repository = repositoryPush.repository;
    var branch = repositoryPush.branchName;

    if (!shouldBeProcessed(repositoryPush, res)) {
        return;
    }

    logger.info("action=process_commit status=START issueKeys=%s, jiraProjectKey=%s, repository=%s, branch=%s",
                issueKeys, jiraProjectKey, repository, branch);
    if (!issueKeys) {
        logger.info("action=process_commit status=ERROR reason=issueKeys_empty commitMessage='%s'",
                     repositoryPush.commitMessage);
        res.status(200).json({"status": "issueKeys are empty - bad commit message"});
        return;
    }
    var componentName = getComponentName(repository);

    var releaseInfoForProject = releaseInfoManager.getReleaseInfo(jiraProjectKey);
    var fixVersion = releaseInfoForProject.getFixVersion(branch);
    if (!fixVersion) {
        logger.warn("No fix version defined for branch=%s, current releaseInfo=", branch, releaseInfoForProject);
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

function getComponentName(repository) {
    if (_.contains(ignoreComponentRepositories, repository)){
        return null;
    }
    if (repositoryMapping.has(repository)) {
        return repositoryMapping.get(repository);
    } else if (useCamelCaseComponentName) {
        return upperCamelCase(repository);
    } else {
        return null;
    }
}

function shouldBeProcessed(repositoryPush, res) {
    var branch = repositoryPush.branchName;
    if (!branch) {
        logger.info("Branch not specified");
        res.status(200).json({"status" : "Branch not specified in new changes"});
        return false;
    }

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
    if (repositoryPush.branchCreated) {
        logger.info("Created branch %s, skipping", branch);
        res.status(200).json({"status" : "Not processed, branch was created instead of commit"});
        return false;
    }
    return true;
}

var server = app.listen(process.env.PORT || 8080, function () {
    releaseInfoManager.reloadReleaseInfo(function (err) {
        if (err) {
            process.exit();
        }
    });
    logger.info("action=commit_hook_app status=READY port=%d", server.address().port)
});

process.on('SIGINT', function() {
    logger.info("action=commit_hook_app status=STOP");
    process.exit();
});
