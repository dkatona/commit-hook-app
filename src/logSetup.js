'use strict';

const winston = require('winston');
winston.level = process.env.LOG_LEVEL || "info";
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({'timestamp':true})
    ]
});

module.exports.logger = logger;