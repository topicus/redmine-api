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

Redmine.prototype.pathPatterns = {
  'issue' : /^issues\/[0-9]+\.?(json|xml)?$/,
  'issues' : /^issues\.?(json|xml)?$/,
  'projects' : /^projects\.?(json|xml)?$/,
  'users' : /^users\.?(json|xml)?$/,
  'time_entries' : /^time_entries\.?(json|xml)?$/,
  'versions' : /^projects\/[a-zA-Z0-9]+\/versions\.?(xml|json)?$/,
  'issue_priorities' : /^enumerations\/\/issue_priorities\.?(xml|json)?$/,
  'time_entry_activities' : /^enumerations\/\/time_entry_activities\.?(xml|json)?$/,
};

Redmine.prototype.createPath = function (path, params) {
  path = (path.slice(0, 1) !== '/') ? path = '/' + path : path;
  return this.host + path + '?' + querystring.stringify(params);
};

Redmine.prototype.api = function (path, opts, cb) {
  var self = this;
  opts = opts || {};

  var results = [];
  var reqCount = 0;
  var numRows = opts.numRows || self.MAX_PAGE_SIZE;
  var hasLimit = false;
  var called_method = self.getCalledMethod(path);

  delete opts.numRows;
  
  if (_.isFunction(opts)) {
    cb = opts;
    opts = {};
  }

  _.defaults(opts, {
    format : 'json',
    method : 'GET',
    offset : 0,
  });
  
  if (numRows === -1) {
    hasLimit = false;
    opts.limit = self.MAX_PAGE_SIZE;
    
    self.getItemsWithoutLimit({
      hasLimit: false,
      opts: opts,
      results: results,
      reqCount: reqCount,
      called_method: called_method,
      numRows: numRows,
      path: path,
      cb: cb
    });
  } else {
    hasLimit = true;
    opts.limit = (numRows > self.MAX_PAGE_SIZE) ? self.MAX_PAGE_SIZE : numRows;
    reqCount = Math.ceil(numRows / opts.limit);
    
    self.getItemsWithLimit({
      hasLimit: true,
      opts: opts,
      results: results,
      reqCount: reqCount,
      called_method: called_method,
      numRows: numRows,
      path: path,
      cb: cb
    });
  }
  return;
};

Redmine.prototype.getCalledMethod = function (path) {
  var self = this;
  for (var key in self.pathPatterns) {
    if (self.pathPatterns[key].test(path)) return key;
  }
  throw new Error('Called method not exists');
};

Redmine.prototype.getItemsWithLimit = function (state) {
  var self = this;
  for (var i = 0; i < state.reqCount; i++) {
    self.processResults(state);
  }
};

Redmine.prototype.getItemsWithoutLimit = function (state) {
  var self = this;
  self.processResults(state);
};

Redmine.prototype.processResults = function (state) {
  var self = this;
  var reqOpts = {
    url : state.opts.method === 'GET' ? self.createPath(state.path, state.opts) : state.path,
    method : state.opts.method,
    headers : {
      'X-Redmine-API-Key': self.apiKey
    }
  };
  state.opts.offset += self.MAX_PAGE_SIZE;
  request(reqOpts, function (err, res, body) {
    if (!err && res.statusCode === 200) {
      var items = JSON.parse(body)[state.called_method];
      var moreOld = false;
      var moreOldIndex = -1;
      console.log(this.href);

      //it have limit and thus can be performed a for loop
      if (state.hasLimit) {
        state.reqCount--;
        
        //if no more pending requests
        if (!state.reqCount && _.isFunction(state.cb)) {
          
          //if we have more results than expected then truncate the results
          if (state.results.length > state.numRows) {
            state.results.length = state.numRows;
          }
          state.results = state.results.concat(items);
          state.cb(null, state.results);
        }
      } else {
        
        //polyfill redmine api. Search until we find an older item
        if (!_.isUndefined(state.opts.date_until)) {
          moreOld = _.some(items, function (item, index) {
            var older = self.isOlder(item, 'updated_on', state.opts.date_until);
            if (older) moreOldIndex = index;
            return older;
          });

          //if we have more results than expected then truncate the results
          if (moreOld) items.length = moreOldIndex;
        }
        state.results = state.results.concat(items);
        if (!moreOld && items && items.length) {
          self.processResults(state);
        } else {
          if (_.isFunction(state.cb)) {
            state.cb(null, state.results);
          }
        }
      }
    } else {
      if (_.isFunction(state.cb)) {
        state.cb(err, null);
      }
    }
  });
};

Redmine.prototype.isOlder = function (item, dateKey, dateCondition) {
  var older = (moment(item[dateKey]).unix() - moment(dateCondition).unix()) <= 0;
  if (older) return true;
  return false;
};

module.exports = Redmine;