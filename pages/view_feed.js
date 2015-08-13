/* Internal utilities */
var sutil = require("../sutil.js");

/* Corresponding Jade renderer */
var renderer = require("jade").compileFile("templates/view_feed.jade");

/* Pagination constant */
const threads_per_page = 20;

/* Request handler */
module.exports.handle_request = function(params, request, response) {
	/* Count threads first, for pagination */
	sutil.db.fetchThreadCount(function(err, thread_count) {
		if(err)
		{
			sutil.logf("Couldn't fetch thread count: %s", err.toString());
			sutil.handle_500(request, response);
		}
		else
		{
			/* URL looks like /view-feed/[pagination index] */
			var pagination_index = (params[1]) ? parseInt(params[1]) : 0;
			var page_count = Math.ceil(thread_count / threads_per_page);

			/* Some defensive programming. 404 for any junk in the URL
			 * so offensive stuff won't get 200 OK */
			if(params.length > 2 ||
				isNaN(pagination_index) || pagination_index < 0 || pagination_index >= page_count)
			{
				sutil.handle_404(request,response);
			}
			else
			{
				sutil.db.fetchFeed(pagination_index, threads_per_page, function(err, feed) {
					if(err)
						sutil.handle_500(request, response);
					else
						sutil.writeSimpleResponse(response, renderer({
							"base_url": "/view-feed/",
							"pagination_index": pagination_index,
							"page_count": page_count,
							"threads": feed
						}));
				});
			}
		}
	});
};
