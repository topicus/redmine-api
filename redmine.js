var request  = require('request')
	,	_	 = require('lodash')
	, moment = require('moment')
	, today  = moment()
	, querystring = require('querystring')

var Redmine = function(host, apiKey){
	this.apiKey = apiKey
	this.host = host
}

Redmine.prototype.createPath = function(path, params){
  if (path.slice(0, 1) != '/') {
    path = '/' + path;
  }
  return this.host + path + '?' + querystring.stringify(params);
}

Redmine.prototype.api = function(path, opts, callback){
	var self 		 = this
		,	url 		 = null
		,	opts 		 = opts || {}
		,	results  = []
		, numRows  = 100
		, reqOpts	 = null
		, i 			 = 0
		,	reqCount = null


	if(typeof opts === 'function'){
		callback = opts
		opts = {}
	}

	if(typeof opts.limit !== 'undefined'){
		numRows = opts.limit
		delete opts.limit
	}

	_.defaults(opts, {
		format	: 'json',
		limit	: 100,
		offset	: 0,
		method: 'GET',
		period_type: 1,
		period: moment().subtract('week', 1).format('YYYY-MM-DD')
	})
	
	reqCount = Math.ceil(numRows / opts.limit)

	for (i = 0; i < reqCount; i++) {
		(function(i){			
			url = self.host + path + '.' + opts.format + '?'
		
			reqOpts = {
		    url: opts.method == 'GET' ? self.createPath(path, opts) : path,
		    method: opts.method,
		    headers: {
		      'X-Redmine-API-Key': self.apiKey
		    }
		  }
		  opts.offset += opts.limit		  
			request(reqOpts, function (err, res, body) {
				if (!err && res.statusCode == 200) {
					var items = JSON.parse(body)[path]
					if(reqCount){						
						results = results.concat(items)						
					}
					reqCount--
					if( (typeof callback === 'function' && !reqCount) || items.length < opts.limit)	
						callback(null, results)		
				}else{
					if(typeof callback === 'function') 
						callback(err, null)
				}
			})
		})(i)
	}
	return;
}











