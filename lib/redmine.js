/*jshint indent:2*/
'use strict';

var request = require('request')
  , _ = require('lodash')
  , moment = require('moment')
  , today = moment()
  , querystring = require('querystring');

function Redmine(host, apiKey) {
  if (!host || !apiKey) {
    throw new Error("Error: apiKey and host are required");
  }
  this.apiKey = apiKey;
  this.host = host;
  this.MAX_PAGE_SIZE = 100;
}

Redmine.prototype.createPath = function (path, params) {
  path = (path.slice(0, 1) !== '/') ? path = '/' + path : path;
  return this.host + path + '?' + querystring.stringify(params);
};

Redmine.prototype.api = function (path, opts, cb) {
  var self = this;
  self.results = [];
  self.cb = cb;
  self.path = path;
  self.opts = opts || {};
  self.reqCount = 0;
  self.numRows = opts.numRows || self.MAX_PAGE_SIZE;
  self.hasLimit = false;

  delete opts.numRows;
  
  if (_.isFunction(self.opts)) {
    self.cb = self.opts;
    self.opts = {};
  }

  _.defaults(opts, {
    format : 'json',
    method : 'GET',
    offset : 0,
  });
  
  if (self.numRows === -1) {
    self.hasLimit = false;
    self.opts.limit = self.MAX_PAGE_SIZE;
    self.getItemsWithoutLimit();
  } else {
    self.hasLimit = true;
    self.opts.limit = (self.numRows > self.MAX_PAGE_SIZE) ? self.MAX_PAGE_SIZE : self.numRows;
    self.reqCount = Math.ceil(self.numRows / self.opts.limit);
    self.getItemsWithLimit(self.reqCount);
  }
  return;
};

Redmine.prototype.getItemsWithLimit = function (reqCount) {
  var self = this;
  for (var i = 0; i < reqCount; i++) {
    self.processResults();
  }
};

Redmine.prototype.getItemsWithoutLimit = function () {
  var self = this;
  self.processResults();
};

Redmine.prototype.processResults = function () {
  var self = this
    , url = self.host + self.path + '.' + self.opts.format + '?';

  var reqOpts = {
    url : self.opts.method === 'GET' ? self.createPath(self.path, self.opts) : self.path,
    method : self.opts.method,
    headers : {
      'X-Redmine-API-Key': self.apiKey
    }
  };
  self.opts.offset += self.MAX_PAGE_SIZE;
  request(reqOpts, function (err, res, body) {
    if (!err && res.statusCode === 200) {
      var items = JSON.parse(body)[self.path];
      if (self.reqCount || !self.hasLimit) {
        self.results = self.results.concat(items);
      }
      self.reqCount--;
      if (self.hasLimit) {
        if (!self.reqCount && _.isFunction(self.cb)) {
          self.results.length = self.numRows;
          self.cb(null, self.results);
        }
      } else {
        if (items.length) {
          self.processResults();
        } else {
          if (_.isFunction(self.cb)) {
            self.cb(null, self.results);
          }
        }
      }
    } else {
      if (_.isFunction(self.cb)) {
        self.cb(err, null);
      }
    }
  });
};

module.exports = Redmine;