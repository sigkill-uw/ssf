var sutil = require("../sutil.js");
var qs = require("querystring");

var renderer = require("jade").compileFile("templates/author_thread.jade");

module.exports.handle_request= function(params, request, response) {
	if(request.method == "POST")
	{
		var raw = "";
		request.on("data", function(chunk){ raw += chunk.toString(); })
		request.on("end", function() {
			var post_data = qs.parse(raw);

			if(!post_data.nickname) post_data.nickname = "";
			if(!post_data.password) post_data.password = "";
			if(!post_data.title) post_data.title = "";
			if(!post_data.content) post_data.content = "";

			sutil.logf("Request to create thread w/ title '%s', nickname '%s', content '%s'",
				post_data.title, post_data.nickname, post_data.content);

			sutil.db.createThread(
					post_data.nickname,
					post_data.password,
					post_data.title,
					post_data.content,
					function(err, res) {
						if(err)
						{
							if(err instanceof sutil.db.FriendlyError)
							{
								var data = renderer({
									"form_error": err,
									"cached_nickname": post_data.nickname,
									"cached_title": post_data.title,
									"cached_content": post_data.content});
								response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
								response.end(data);
							}
							else
							{
								throw "oops";
								/* TODO */
							}
						}
						else
						{
							response.writeHead(303, {"Location": "/view-thread/" + res});
							response.end();
						}
					});
			});
	}
	else
	{
		var data = renderer();
		response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
		response.end(data);
	}
};
