"use strict";

var _ = require('lodash');

exports.container = null;

exports.init = function(container, callback) {

    exports.container = container;

    container.addListener('add', onAdd);
    container.addListener('request', onRequest);

    callback(null);
};

exports.close = function(callback) {

    callback(null);
};

exports.request = onRequest;

function onAdd(req, res) {

    var controller = require('./controllers/analyticsController');

    controller.create(req.data, res, exports.container);
}

function onRequest(req, res) {

    var controller = require('./controllers/analyticsController');

    var checklist = ['APIAUTH'];

    var dest = getRouteDestination(req.data);

    if(!dest) {

        return res.error(new Error('ResourceNotFound'))
    }

    exports.container.getService('AUTH').then(function(service) {

        var reqData = {checklist : checklist};

        var deep = function(a, b) {
            return _.isObject(a) && _.isObject(b) ? _.assign(a, b, deep) : b;
        };

        service.send('check', _.assign(reqData, req.data, deep), function(err, response) {

            if(err) {

                return res.error(err);
            }

            req.data.session = response.data.session;

            controller[dest](req.data, res, exports.container);
        });

    }).fail(function(err) {

        res.error(new Error('auth service not found'));
    });
}

function getRouteDestination(reqData) {

    var dest = '';

    switch(reqData.method) {

        case 'GET' :
            dest = 'find';
            break;
    }
    return dest;
}