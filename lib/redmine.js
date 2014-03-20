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
  'relations' : /^attachments\/[0-9]+\/relations\.?(json|xml)?$/,
  'users' : /^users\.?(json|xml)?$/,
  'user' : /^users\/[0-9]+\.?(json|xml)?$/,
  'time_entries' : /^time_entries\.?(json|xml)?$/,
  'issue_statuses' : /^issues_statuses\.?(json|xml)?$/,
  'projects' : /^projects\.?(json|xml)?$/,
  'versions' : /^projects\/[a-zA-Z0-9\+\-\_]+\/versions\.?(xml|json)?$/,
  'memberships' : /^projects\/[a-zA-Z0-9\+\-\_]+\/memberships\.?(xml|json)?$/,
  'issue_categories' : /^projects\/[a-zA-Z0-9\+\-\_]+\/issue_categories\.?(xml|json)?$/,
  'issue_priorities' : /^enumerations\/issue_priorities\.?(xml|json)?$/,
  'time_entry_activities' : /^enumerations\/time_entry_activities\.?(xml|json)?$/,
  'groups' : /^groups\.?(json|xml)?$/,
  'trackers' : /^trackers\.?(json|xml)?$/,
  'attachments' : /^attachments\/[0-9]+\.?(json|xml)?$/,
  'roles' : /^roles\.?(json|xml)?$/,
};

var UPDATE_METHODS = {'POST':null, 'PUT':null, 'DELETE':null};


Redmine.prototype.createPath = function (path, params, method) {
  path = (path.slice(0, 1) !== '/') ? path = '/' + path : path;
  if(method==='GET'){
    return this.host + path + '.' + params.format  + '?' + querystring.stringify(params);
  }else{
    return this.host + path + '.' + params.format;
  }
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
  throw new Error('Called method not exists: ' + path);
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
    url : self.createPath(state.path, state.opts, state.opts.method),
    method : state.opts.method,
    headers : {
      'X-Redmine-API-Key': self.apiKey,
      'Content-Type': 'application/json'

    },
    body: (state.opts.method === 'POST' || state.opts.method === 'PUT' || state.opts.method === 'DELETE') ? JSON.stringify(state.opts.body) : ''
  };
  state.opts.offset += self.MAX_PAGE_SIZE;
  request(reqOpts, function (err, res, body) {
    console.log(this.href);
    //IF NOT FAIL
    if (res && !err && (res.statusCode === 200  || res.statusCode === 201 )) {
      //REQUEST POST
      if(reqOpts.method === 'POST'){ 
        state.cb(null, JSON.parse(body));
      //REQUEST PUT OR DELETE
      } else if(reqOpts.method === 'PUT' || reqOpts.method === 'DELETE') {
        state.cb(null, {status:'OK'});
      //REQUEST GET
      } else {
        var items = JSON.parse(body)[state.called_method];
        var moreOld = false;
        var moreOldIndex = -1;
        //it have limit and thus can be performed a for loop
        if (state.hasLimit) {
          state.reqCount--;
          state.results = state.results.concat(items);

          //if no more pending requests
          if (!state.reqCount && _.isFunction(state.cb)) {
            
            //if we have more results than expected then truncate the results
            if (state.results.length > state.numRows) {
              state.results.length = state.numRows;
            }
            state.cb(null, state.results);
          }
        } else {
          //polyfill redmine api. Search until we find an older item
          if (!_.isUndefined(state.opts.date_until)) {
            moreOld = _.some(items, function (item, index) {
              var dateCondition = (state.called_method === 'time_entries') ? 'spent_on' : 'updated_on';
              var older = self.isOlder(item, dateCondition, state.opts.date_until);
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
      }
    } else if(res.statusCode !== 200 && res.statusCode !== 201 ){
      err = new Error('Error bad status code');
      if (_.isFunction(state.cb)) {
        state.cb(err, null);
      }
    } else {
      if (_.isFunction(state.cb)) {
        if(err){
          state.cb(err, null);
        }else{
          state.cb(new Error('Ocurrio un error inesperado'), null);
        }
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