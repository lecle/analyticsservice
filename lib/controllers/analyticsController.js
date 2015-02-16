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

                service.send('insert', {collectionName : data.appid, data : data}, function(err, doc) {

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

        req.query.where._className = '_Analytics';

        service.send('find', {collectionName : req.session.appid, query: req.query}, function (err, docs) {

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