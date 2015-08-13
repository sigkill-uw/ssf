/* Internal utilities */
var sutil = require("../sutil.js");

/* Corresponding Jade renderer */
var renderer = require("jade").compileFile("templates/view_feed.jade");

/* Pagination constant */
const threads_per_page = 20;

/* Request handler */
module.exports.handle_request = function(params, request, response) {
	/* URL looks like /view-feed/[pagination index] */
	var pagination_index = (params[1]) ? parseInt(params[1]) : 0;
	if(isNaN(pagination_index)) pagination_index = 0;

	/* Count threads first, for pagination */
	sutil.db.fetchThreadCount(function(err, thread_count) {
		sutil.db.fetchFeed(pagination_index, threads_per_page, function(err, feed) {
			if(err)
				sutil.handle_500(response);
			else
				sutil.writeSimpleResponse(response, renderer({
					"base_url": "/view-feed/",
					"pagination_index": pagination_index,
					"page_count": Math.ceil(thread_count / threads_per_page),
					"threads": feed
				}));
		});
	});
};
