var request  = require('request')
	,	_	 = require('lodash')
	, moment = require('moment')
	, today  = moment()

var Redmine = function(endpoint, apiKey){
	this.apiKey = apiKey
	this.endpoint = endpoint
}

Redmine.prototype.api = function(method, options, callback){
	var self 	= this
		,	url 	= null
		,	options = options || {}
		,	results = []

	if(typeof options === 'function'){
		callback = options
		options = {}
	}

	_.extend(options, {
		format	: 'json',
		limit	: 100,
		offset	: 0,
		dateFrom: moment().subtract('week', 1)
	})

	var offset = options.offset

	function next(condition){
		url = self.endpoint + method + '.' + options.format + '?' 
		+ 'limit=' + options.limit + '&offset=' + offset
		+ '&key=' + self.apiKey

		request(url, function (err, res, body) {
			if (!err && res.statusCode == 200) {
				var result 		= JSON.parse(body)[method]
				var oldItem 	= moment(result[0].spent_on).unix()
					,	itemDate	= null

				_.each(result, function(item){					
					itemDate = moment(item.spent_on)
					itemDate = (oldItem < itemDate) ? oldItem : itemDate
				})			
				if(itemDate > moment(condition).unix()){
					offset += 100
					results = results.concat(result)
					next(condition)						
				}else{
					if(typeof callback === 'function') callback(null,results)
				}		
			}else{
				if(typeof callback === 'function') callback(err,null)
			}

		})
	}
	next(options.dateFrom)
	return;
}

var redmine = new Redmine('http://redmine.buenosaires.gob.ar/','883475b5c3ada34d6236a89496f45a5f422d1ddf')
redmine.api('time_entries', function(err, res){
	console.log(res)
});













