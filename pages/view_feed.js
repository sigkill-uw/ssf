var sutil = require("../sutil.js");

var renderer = sutil.wrapWithBuffer(require("jade").compileFile("templates/view_feed.jade"));

module.exports.handle_request = function(params, request, response) {
	sutil.db.fetchFeed(0, 999999999, function(err, threads) {
		if(err)
		{
			var data = "Internal server error. Please try again later.";
			response.writeHead(500, {"Content-Type": "text/plain", "Content-Length": data.length});
			response.end(data);
		}
		else
		{
			var data = renderer({"threads": threads});
			response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
			response.end(data);
		}
	});
}
