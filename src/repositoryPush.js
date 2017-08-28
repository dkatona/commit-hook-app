'use strict';

//see https://answers.atlassian.com/questions/325865/regex-pattern-to-match-jira-issue-key
var jira_matcher = /\d+-[A-Z]+(?!-?[a-zA-Z]{1,10})/g;
var issue_matcher = /([A-Z]+)-\d+/;

function RepositoryPush(json) {
    this.actor = json.actor.username;
    this.repository = json.repository.name;

    var newChange = json.push.changes[0].new;
    //if branch is created, created=true
    //if commit is pushed to an existing branch, created=false
    this.branchCreated = json.push.changes[0].created;
    if (newChange) {
        this.changeType = newChange.type;
        this.branchName = newChange.name;
        this.commitHash = newChange.target.hash;
        this.commitAuthor = newChange.target.author.username;
        this.commitMessage = newChange.target.message;
        this.commitDate = newChange.target.date;
    }
    this.issueKeys = issueKeys(this.commitMessage);
    this.jiraProjectKey = jiraProjectKey(this.issueKeys);
}

function issueKeys(commitMessage) {
    if (commitMessage) {
        var commitMessageReversed = reverseString(commitMessage);
        var matched = commitMessageReversed.match(jira_matcher);

        if (matched) {
            // Also need to reverse all the results!
            for (var i = 0; i < matched.length; i++) {
                matched[i] = reverseString(matched[i])
            }
            matched.reverse();
            return matched;
        }
    }
}

function jiraProjectKey(issueKeys) {
    if (issueKeys) {
        for (var i = 0; i < issueKeys.length; i++) {
            var jiraKeySplit = issue_matcher.exec(issueKeys[i]);
            if (jiraKeySplit) {
                return jiraKeySplit[1];
            }
        }
    }
}

function reverseString(str) {
    return str.split("").reverse().join("");
}

module.exports = RepositoryPush;