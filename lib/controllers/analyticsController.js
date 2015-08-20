"use strict";

var async = require('async');
var appCache = {};
var userCache = {};

exports.create = function(req, res, container) {

    var data = req.data;

    container.getService('MONGODB').then(function(service) {

        async.waterfall([
            function(callback){

                var appid = data.headers['x-noserv-application-id'];
                if(!appid)
                    return callback(null);

                if(appid == 'supertoken') {
                    data.appid = 'test';
                    data.appname = 'test';

                    return callback(null);
                }

                if(appCache[appid]) {

                    data.appid = appCache[appid].appid;
                    data.appname = appCache[appid].appname;

                    return callback(null);
                }

                service.send('findOne', {collectionName : 'apps', query : {where : {applicationId : appid}}}, function(err, res) {
                    var doc = res.data;

                    if(err || !doc)
                        return callback(null);

                    appCache[appid] = {};

                    appCache[appid].appid = data.appid = doc.objectId;
                    appCache[appid].appname = data.appname = doc.appname;

                    callback(null);
                });
            },
            function(callback){

                if(!data.appid || data.headers['x-noserv-session-token'])
                    return callback(null);

                var token = data.headers['x-noserv-session-token'];

                if(userCache[token]) {

                    data.userid = userCache[token].userid;
                    data.username = userCache[token].appname;

                    return callback(null);
                }

                service.send('findOne', {collectionName : data.appid, query : {where : {_className : '_Users', sessionToken : token}}}, function(err, res) {
                    var doc = res.data;

                    if(err || !doc)
                        return callback(null);

                    userCache[token] = {};

                    userCache[token].userid = data.userid = doc.objectId;
                    userCache[token].username = data.username = doc.username;

                    callback(null);
                });
            },
            function(callback){

                container.getService('ANALYTICSDB').then(function(analyticsDbService) {

                    if(!data.appid)
                        data.appid = 'analytics';

                    data._className = '_Analytics';

                    analyticsDbService.send('insert', {collectionName : data.appid + '_Analytics', data : data}, function(err, doc) {

                        if(err)
                            return res.error(err);

                        res.send(201, {
                            createdAt : doc.data.createdAt,
                            objectId : doc.data.objectId
                        });

                        callback(null, 'done');
                    });
                }).fail(function(err) {

                    res.error(err);
                });
            }
        ], function (err, result) {
            // result now equals 'done'
        });
    }).fail(function(err) {

        res.error(err);
    });
};

exports.find = function(req, res, container) {

    container.getService('ANALYTICSDB').then(function (service) {

        if(!req.query.where)
            req.query.where = {};

        var now = new Date();
        var yesterday = new Date(now);

        yesterday.setDate(now.getDate() - 1);

        req.query.where.createdAt = {

            "$gte": {"$ISODate": yesterday}
        };

        if(!req.query.limit || req.query.limit > 100)
            req.query.limit = 100;

        service.send('find', {collectionName : req.session.appid + '_Analytics', query: req.query}, function (err, docs) {

            if (err)
                return res.error(err);

            if (typeof(docs.data) === 'number') {

                res.send(200, {results: [], count: docs.data});
            } else {

                res.send(200, {results: docs.data});
            }
        });
    }).fail(function (err) {

        res.error(err);
    });
};


exports.aggregate = function(req, res, container) {

    if(!Array.isArray(req.aggregate))
        res.error(new Error('[aggregate] type error'));

    container.getService('ANALYTICSDB').then(function(service) {

        service.send('aggregate', {collectionName : req.session.appid + '_Analytics', aggregate : req.aggregate}, function(err, docs) {

            if(err)
                return res.error(err);

            res.send(200, {results: docs.data});
        });
    }).fail(function(err) {

        res.error(err);
    });
};
