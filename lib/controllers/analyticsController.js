"use strict";

var async = require('async');

exports.create = function createUsers(req, res, container) {

    var data = req.data;

    container.getService('MONGODB').then(function(service) {

        async.waterfall([
            function(callback){

                if(!data.headers['x-noserv-application-id'])
                    return callback(null);

                service.send('findOne', {collectionName : 'apps', query : {where : {applicationId : data.headers['x-noserv-application-id']}}}, function(err, res) {
                    var doc = res.data;

                    if(err || !doc)
                        return callback(null);


                    data.appid = doc.objectId;
                    data.appname = doc.appname;

                    callback(null);
                });
            },
            function(callback){

                if(!data.appid || data.headers['x-noserv-session-token'])
                    return callback(null);

                service.send('findOne', {collectionName : data.appid, query : {where : {_className : '_Users', sessionToken : data.headers['x-noserv-session-token']}}}, function(err, res) {
                    var doc = res.data;

                    if(err || !doc)
                        return callback(null);

                    data.userid = doc.objectId;
                    data.username = doc.username;

                    callback(null);
                });
            },
            function(callback){

                if(!data.appid)
                    data.appid = 'analytics';

                data._className = '_Analytics';

                service.send('insert', {collectionName : data.appid + '_Analytics', data : data}, function(err, doc) {

                    if(err)
                        return res.error(err);

                    res.send(201, {
                        createdAt : doc.data.createdAt,
                        objectId : doc.data.objectId
                    });

                    callback(null, 'done');
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
                        return callback(err);

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
                    query : [
                        { $match : { _className : '_Files' }},
                        { $group : {
                            _id : { _className : "$_className" },
                            size : { $sum : "$size" },
                            count: { $sum: 1 }
                        }}
                    ]}, function(err, docs) {

                    if(err)
                        return callback(err);

                    if(!docs.data || docs.data.length !== 1)
                        return callback(null);

                    stats.file = {};
                    stats.file.size = docs.data[0].size;
                    stats.file.count = docs.data[0].count;

                    callback(null);
                });
            },
            function(callback) {

                var data = req.data;

                if(!data.appid)
                    data.appid = 'analytics';

                service.send('aggregate', {
                    collectionName : data.appid + '_Analytics',
                    query : [
                        { $group : {
                            _id : { month : {$month : '$createdAt'}, year : {$year : '$createdAt'} },
                            size : { $sum : "$responseSize" },
                            count: { $sum: 1 }
                        }}
                    ]}, function(err, docs) {

                    if(err)
                        return callback(err);

                    if(!docs.data || docs.data.length !== 1)
                        return callback(null, 'done');

                    stats.request = {};
                    stats.request.size = docs.data[0].size;
                    stats.request.count = docs.data[0].count;

                    callback(null, 'done');
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