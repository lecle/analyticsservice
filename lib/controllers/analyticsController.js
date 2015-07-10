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

                    data.userid = userCache[token].objectId;
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

    container.getService('MONGODB').then(function (service) {

        var stats = {};

        async.waterfall([
            function(callback) {

                service.send('stats', {collectionName : req.session.appid}, function (err, docs) {

                    if(err)
                        return callback(null);

                    if(!docs.data)
                        return callback(null);

                    stats.db = {};
                    stats.db.size = docs.data.size;
                    stats.db.count = docs.data.count;

                    callback(null);
                });
            },
            function(callback) {

                service.send('aggregate', {
                    collectionName : req.session.appid,
                    aggregate : [
                        { $match : { _className : '_Files' }},
                        { $group : {
                            _id : { _className : "$_className" },
                            size : { $sum : "$size" },
                            count: { $sum: 1 }
                        }}
                    ]}, function(err, docs) {

                    if(err)
                        return callback(null);

                    if(!docs.data || docs.data.length !== 1)
                        return callback(null);

                    stats.file = {};
                    stats.file.size = docs.data[0].size;
                    stats.file.count = docs.data[0].count;

                    callback(null);
                });
            },
            function(callback) {

                container.getService('ANALYTICSDB').then(function(analyticsDbService) {

                    analyticsDbService.send('aggregate', {
                        collectionName : req.session.appid + '_Analytics',
                        aggregate : [
                            { $group : {
                                _id : { month : {$month : '$createdAt'}, year : {$year : '$createdAt'} },
                                size : { $sum : "$responseSize" },
                                count: { $sum: 1 }
                            }}
                        ]}, function(err, docs) {

                        if(err)
                            return callback(null);

                        if(!docs.data || docs.data.length < 1)
                            return callback(null, 'done');

                        stats.request = docs.data;

                        callback(null, 'done');
                    });
                }).fail(function(err) {

                    res.error(err);
                });
            }
        ], function (err, result) {

            if(err)
                res.error(err);

            res.send(200, stats);
        });

    }).fail(function (err) {

        res.error(err);
    });
};
