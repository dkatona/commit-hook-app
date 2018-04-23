'use strict';

var express = require('express');
var config = require('config');

var logger = require('./logSetup').logger;

var token = config.get("Authentication.token");

var app = express();
app.use(require('body-parser').json());

app.all("*", function (req, res, next) {
    if (req.query.token !== token) {
        res.status(401).end()
    } else {
        next()
    }
});

function configureValidation(jiraClient) {
    app.use(require('express-validator')( {
        customValidators: {
            releaseVersionExists: function (version, project) {
                return new Promise(function (resolve, reject) {
                    jiraClient.releaseExists(version, project, function (error, jiraVersion) {
                        //rather return false if we can't check if release exists
                        if (error || !jiraVersion.exists) {
                            reject(error);
                        } else {
                            resolve(true);
                        }
                    });
                });
            }
        }
        }));
}

module.exports.app = app;
module.exports.configureValidation = configureValidation;

