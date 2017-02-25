'use strict';

var express = require('express');
var config = require('config');

var logger = require('./logSetup').logger;

var token = config.get("Authentication.token");

var app = express();
app.use(require('body-parser').json());
app.use(require('express-validator')());

app.all("*", function (req, res, next) {
    if (req.query.token !== token) {
        res.status(401).end()
    } else {
        next()
    }
});

module.exports.app = app;