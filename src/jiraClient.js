'use strict';

var _ = require('underscore');
var config = require('config');
var async = require('async');
var logger = require('./setup/logSetup').logger;
var fs = require('fs');

var JiraClient = require('jira-connector');

var jira = new JiraClient({
    host: config.get("Jira.host"),
    oauth: {
        consumer_key: config.get("Jira.consumer_key"),
        private_key: readPrivateKey(config.get("Jira.private_key_path")),
        token: config.get("Jira.token"),
        token_secret: config.get("Jira.token_secret")
    }
});

function readPrivateKey(path) {
    try {
        logger.debug("action=read_private_key status=START path=%s", path);
        var data = fs.readFileSync(path, 'utf8');
        logger.debug("action=read_private_key status=FINISH path=%s", path);
        return data;
    } catch(e) {
        logger.error("action=read_private_key status=ERROR path=%s err=%s", path, e);
    }
}

function getIssuesWithParents(issueKeys, callback) {
    logger.debug("action=fetch_issues status=START issueKeys=%s", issueKeys);
    var asyncTasks = [];
    issueKeys.forEach(function(issueKey) {
        asyncTasks.push(getIssueWithParent.bind(this, issueKey));
    });
    async.parallel(asyncTasks, function(error, results) {
                       var issues = [];
                       if (!error) {
                           issues = _.uniq(_.flatten(results));
                           logger.debug("action=fetch_issues status=FINISH issues=%s", issues);
                       } else {
                           logger.error("action=fetch_issues status=ERROR err=%s", JSON.stringify(error));
                       }
                       callback(error, issues);
                   }
    );
}

function getIssueWithParent(issueKey, callback) {
    logger.debug("action=fetch_issue status=START key=%s", issueKey);
    jira.issue.getIssue({issueKey: issueKey}, function (error, issue) {
        var issues = [issueKey];
        if (issue.fields.parent) {
            issues.push(issue.fields.parent.key);
        }
        if (!error) {
            logger.debug("action=fetch_issue status=FINISH keys=%s", issues);
        } else {
            logger.error("action=fetch_issue status=ERROR key=%s error=%s", issueKey, JSON.stringify(error));
        }
        callback(error, issues);
    });
}

function updateIssue(issueKey, component, fixVersion, callback) {
    logger.debug("action=update_issue status=START key=%s", issueKey);
    if (!component && !fixVersion) {
        logger.error("action=update_issue status=ERROR reason=fix_version/component_empty key=%s", issueKey);
        callback("At least one of component, fixVersion must be defined!", null);
    } else {
        var issueUpdate = {issueKey: issueKey, issue:{ update: {}}};
        if (component) {
            logger.debug("Adding component=%s to issue=% update", component, issueKey);
            issueUpdate.issue.update.components = [{add:{ name : component}}];
        }
        if (fixVersion) {
            logger.debug("Adding fixVersion=%s to issue=% update", fixVersion, issueKey);
            issueUpdate.issue.update.fixVersions = [{add: {name : fixVersion}}];
        }

        jira.issue.editIssue(issueUpdate, function (error, result) {
            if (!error) {
                logger.debug("action=update_issue status=FINISH key=%s result=%s", issueKey, result);
            } else {
                logger.error("action=update_issue status=ERROR key=%s error=%s", issueKey, JSON.stringify(error));
            }
            callback(error, result);
        });
    }
}

function updateIssues(issueKeys, component, fixVersion, callback) {
    logger.debug("action=update_issues status=START keys=%s", issueKeys);
    var asyncTasks = [];
    issueKeys.forEach(function(issueKey) {
        asyncTasks.push(updateIssue.bind(this, issueKey, component, fixVersion));
    });
    async.parallel(asyncTasks, function (error, result) {
        if (!error) {
            logger.debug("action=update_issues status=FINISH keys=%s", issueKeys);
        } else {
            logger.error("action=update_issues status=ERROR keys=%s error=%s", issueKeys, JSON.stringify(error));
        }
        callback(error, result);
    });
}

module.exports = {
    jira : jira,
    getIssuesWithParents : getIssuesWithParents,
    updateIssues : updateIssues
};
