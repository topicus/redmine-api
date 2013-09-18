var expect = require('chai').expect
  , path = require('path')
  , basedir = path.join(__dirname, '..')
  , Redmine = require(path.join(basedir, 'lib/redmine.js'))
  , assert = require('assert')
  , should = require('chai').should()

assert.ok('REDMINE_APIKEY' in process.env);
assert.ok('REDMINE_HOST' in process.env);

var redmine = new Redmine(process.env.REDMINE_HOST,process.env.REDMINE_APIKEY)

describe('#call small with limit', function () {
    it('should return 1 user', function (done) {
        redmine.api('users', {numRows:10}, function(err, res){
          if (err) return done(err);
          res.should.have.length(10);
          done();          
        })        
    });
});

describe('#call with huge limit', function () {
    it('should return 200 user', function (done) {
        redmine.api('users', {numRows:200}, function(err, res){
          if (err) return done(err);
          res.should.have.length(200);
          done();
        })        
    });
});