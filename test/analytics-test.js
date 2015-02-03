var analytics = require('../lib/analytics');

describe('analytics', function() {
    describe('#init()', function() {
        it('should initialize without error', function(done) {

            // manager service load
            var dummyContainer = {addListener:function(){}};

            analytics.init(dummyContainer, function(err) {

                analytics.close(done);
            });
        });
    });

});