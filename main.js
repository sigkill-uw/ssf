/* HTTP server + filesystem access */
var http = require("http");
var fs = require("fs");

/* Internal utilities */
var sutil = require("./sutil.js");

/* Requests to be served directly from the filesystem (w/ corresponding MIME type) */
var filesystem_whitelist = {
	"/style.css": "text/css",
	"/favicon.ico": "image/x-icon"
};

/* Index page - to be invoked for the URL "/" */
const index_page_id = "view-feed";

/* Page handlers - callbacks of the form fn(url_params, request, response */
var page_handlers =	{
	"view-feed": require("./pages/view_feed.js").handle_request,
	"view-thread": require("./pages/view_thread.js").handle_request,
	"author-thread": require("./pages/author_thread.js").handle_request
};

var not_found_renderer = function(){ return "404"; }

sutil.log("ssf starting up");

/* Connect to Mongo */
sutil.log("Connecting to MongoDB");
sutil.db.connect(function(err) {
	if(err)
	{
		/* Die */
		sutil.log("Fatal: couldn't connect to MongoDB");
		throw err;
	}
	else
	{
		sutil.log("Connected to MongoDB");

		/* Listen w/ HTTP server */
		sutil.log("Instantiating HTTP server");
		http.createServer(function(request, response) {
			sutil.logf("%s request received to URL '%s' from IP %s",
				request.method, request.url, request.connection.remoteAddress);

			/* Serve appropriate files directly from the filesystem */
			if(request.url in filesystem_whitelist)
			{
				/* Read the file en masse from the disk and serve it
				 * NB. none of these files are big */
				fs.readFile("static/" + request.url, function(err, data) {
					if(err)
					{
						/* Not a 404 - we have every expectation that the file exists */
						var text = "Something went wrong. Please try again later.";
						response.writeHead(500, {"Content-Length": text.length, "Content-Type": "text/plain"});
						response.end(text);

						sutil.log("Failed to serve static file '%s': %s", request.url, err.toString());
					}
					else
					{
						/* Use appropriate MIME type */
						response.writeHead(200, {
							"Content-Length": data.length,
							"Content-Type": filesystem_whitelist[request.url]
						});

						response.end(data);
					}
				});
			}
			else
			{
				/* Extract params */
				var params = (request.url === "/" ? [index_page_id] : urlSplit(request.url));

				/* Check if it fits any of our handlers */
				if(params[0] in page_handlers)
				{
					page_handlers[params[0]](params, request, response);
				}
				else
				{
					/* 404 */
					var data = not_found_renderer({"title": "Page Not Found"});
					response.writeHead(200, {"Content-Type": "text/html", "Content-Length": data.length});
					response.end(data);
				}
			}
		}).listen(32601, function(err) {
			if(err)
			{
				/* Die */
				sutil.log("Fatal: HTTP server failed to listen");
				throw err;
			}
			else sutil.log("HTTP server now listening");
		});
	}
});

/* urlSplit - splits a URL along "/" and discards any empty strings
 * We use this to extract parameters from the URL */
function urlSplit(url)
{
	var sp = url.split("/");
	var pa = [];

	for(var i = 0; i < sp.length; i ++)
		if(sp[i]) pa.push(sp[i]);

	return pa;
}
