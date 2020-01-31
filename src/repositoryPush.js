'use strict';

//see https://answers.atlassian.com/questions/325865/regex-pattern-to-match-jira-issue-key
var jira_matcher = /\d+-[A-Z]+(?!-?[a-zA-Z]{1,10})/g;
var issue_matcher = /([A-Z]+)-\d+/;

function RepositoryPush(json) {
    if (json.ref != null) {
        parseGithubPayload(json, this);
    } else {
        parseBitbucketPayload(json, this);
    }
    this.issueKeys = issueKeys(this.commitMessage);
    this.jiraProjectKey = jiraProjectKey(this.issueKeys);
}

function parseGithubPayload(json, self) {
    console.log(json);
    self.actor = json.pusher.name;
    self.repository = json.repository.name;
    //ignore if we something else than heads (e.g. tags)
    if (json.ref.includes("heads")) {
        var match = json.ref.match(/refs\/heads\/(.*)/);
        self.branchName = match[1];
    }
    if (json.head_commit != null) {
        self.commitHash = json.head_commit.id;
        self.commitAuthor = json.head_commit.author.name;
        self.commitMessage = json.head_commit.message;
        self.commitDate = json.head_commit.timestamp;
    }
}

function parseBitbucketPayload(json, self) {
    self.actor = json.actor.username;
    self.repository = json.repository.name;

    var newChange = json.push.changes[0].new;
    //if branch is created, created=true
    //if commit is pushed to an existing branch, created=false
    self.branchCreated = json.push.changes[0].created;
    if (newChange) {
        self.changeType = newChange.type;
        self.branchName = newChange.name;
        self.commitHash = newChange.target.hash;
        self.commitAuthor = newChange.target.author.username;
        self.commitMessage = newChange.target.message;
        self.commitDate = newChange.target.date;
    }
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