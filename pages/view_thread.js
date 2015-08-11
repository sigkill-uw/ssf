var sutil = require("../sutil.js");
var qs = require("querystring");

var renderer = require("jade").compileFile("templates/view_thread.jade");

module.exports.handle_request = function(params, request, response) {
	var thread_id = params[1];

	var pagination_index = parseInt(params[2] ? params[2] : 0);
	if(isNaN(pagination_index)) pagination_index = 0;

	if(request.method == "POST")
	{
		var raw = "";
		request.on("data", function(chunk){ raw += chunk.toString(); })
		request.on("end", function() {
			var post_data = qs.parse(raw);

			sutil.db.createReply(thread_id,
				post_data.nickname,
				post_data.password,
				post_data.title,
				post_data.content,
				function(err, res) {
					if(err)
					{
						var fe = err;
						if(err instanceof sutil.db.FriendlyError)
						{
							sutil.db.fetchThread(thread_id, 0, 9999999, function(err, thread) {
								if(err)
								{
									throw err;
									/* todo */
								}
								else
								{
									var data = renderer({
										"thread": thread,
										"form_error": fe,
										"cached_nickname": post_data.nickname,
										"cached_title": post_data.title,
										"cached_content": post_data.content});

									response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
									response.end(data);
								}
							});
						}
						else response.end("shit");
					}
					else if(!res) response.end("Fixme");
					else
					{
						response.writeHead(303, {"Location": request.url});
						response.end();
					}
			});
		});
	}
	else
	{
		sutil.db.fetchThread(thread_id, 0, 9999999, function(err, thread) {
			if(err)
			{
				/* TODO */
			}
			else if(!thread) response.end("Fixme");
			else
			{
				var data = renderer({"thread": thread});
				response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
				response.end(data);
			}
		});
	}
};
