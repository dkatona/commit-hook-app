# commit-hook-app

This app can be used to update **Component** and **Fix Version** fields in JIRA upon a commit in bitbucket.

##How to run it

The app can be run in docker - you need to supply path to configuration directory (see below)
and expose a port as it is an Express.js app.

```
docker run -v path_to_config:/usr/src/app/config -p 8080:8080 commit-hook-app
```

###Configuration

Configuration is done with [config module](https://www.npmjs.com/package/config), you can find
sample configurations in `config` folder. These configurations are mandatory:

  * **Jira.*** - host and OAuth 1.0a settings for accessing JIRA. If you want to generate a new
  OAuth token, you can use [jira_get_oauth_token.py](./test/jira_get_oauth_token.py) script.
  * **RepositoryMapping** - mapping of repository names to JIRA components, this setting will be used
  to set Component field
  * **BranchRegex** - array of regular expressions for matching the branch name, commit is processed only 
  for branches that match at least one regex from the array
  * **Authentication.token** - each HTTP request requires a token as a query parameter which
  needs to match this setting
  
There is a second configuration `releaseInfo.json` that is also writable by the app - it stores
mapping between different versions and Fix version fields in JIRA. The setting can be changed through API.

You can override default mapping from `releaseInfo.json` by calling API with jiraKey in path - that call
creates `releaseInfo-jiraKey.json` configuration in the same directory as the original file.
    
### Endpoints

 * GET **/releaseInfo** - returns release information - the content of the releaseInfo.json configuration
 * GET **/releaseInfo/:jiraKey** - returns release information for specific JIRA project with jiraKey. 
 Serves as an override of default configuration.
 * POST **/releaseInfo** - allows to set new release information, particularly after branching a new release
  when fix version is changed
 * POST **/releaseInfo/:jiraKey** - allows to set new release information per specific JIRA project with jiraKey
 * POST **/repositoryPush** - this endpoint needs to be set in bitbucket commit hook as it receives
  payload about the commit push
  
  
  
  
