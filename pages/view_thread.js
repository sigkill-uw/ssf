/* Internal utilities */
var sutil = require("../sutil.js");

/* Query string parser */
var qs = require("querystring");

/* Corresponding Jade renderer */
var renderer = require("jade").compileFile("templates/view_thread.jade");

/* For bbcode */
var BBCodeParser = require('bbcode-parser');
var bbc_parser = new BBCodeParser(BBCodeParser.defaultTags());

/* We pass this into the Jade template
 * We need to wrap parseString to preserve the correct scope */
function parser(text) { return bbc_parser.parseString(text); };

/* Pagination constant */
const replies_per_page = 20;

/* Request handler */
module.exports.handle_request = function(params, request, response) {
	/* URL looks like /view-thread/[thread id]/[friendly name]/[pagination index] */

	var thread_id = params[1];
	var friendly_name = params[2];
	var pagination_index = parseInt(params[3] ? params[3] : 0);
	if(isNaN(pagination_index)) pagination_index = 0;

	var base_url = "/view-thread/" + thread_id + "/" + friendly_name + "/";

	/* Weird note: the layout of the control flow allows you to conceivably write a reply to a post
	 * even if you have the wrong friendly name, however it prevents you from viewing a thread
	 * if the friendly name is incorrect. The latter is intentional to preserve consistent URLs;
	 * the former is incidental and inconsequential - it can't occur without singificant user abuse */

	/* A post request means a new reply */
	if(request.method == "POST")
	{
		/* Buffer and parse POST data */
		var raw = "";
		request.on("data", function(chunk){ raw += chunk.toString(); })
		request.on("end", function() {
			var post_data = qs.parse(raw);

			/* Fill in any potiential missing members */
			if(!post_data.nickname) post_data.nickname = "";
			if(!post_data.password) post_data.password = "";
			if(!post_data.title) post_data.title = "";
			if(!post_data.content) post_data.content = "";

			/* Create the reply */
			sutil.db.createReply(thread_id,
				post_data.nickname,
				post_data.password,
				post_data.title,
				post_data.content,
				function(err, res) {
					if(err)
					{
						/* A FriendlyError indicates a mistake on the user's part
						 * We just pass it into the template to guide them */
						if(err instanceof sutil.db.FriendlyError)
						{
							var fe = err;

							/* Fetch the current thread and render it, incl. the error info */
							sutil.db.fetchThread(thread_id, friendly_name, pagination_index, replies_per_page,
								function(err, thread) {
									if(err) /* Internal error */
									{
										sutil.logf("Error fetching thread %s: %s", thread_id, err.toString());
										sutil.handle_500(request, response);
									}
									else
									{
										/* Render */
										sutil.writeSimpleResponse(response, renderer({
											"pagination_index": pagination_index,
											"page_count": Math.ceil(thread.reply_count / replies_per_page),
											"base_url": base_url,
											"content_parser": parser,
											"thread": thread,
											"form_error": fe,
											"cached_nickname": post_data.nickname,
											"cached_title": post_data.title,
											"cached_content": post_data.content}));
									}
								});
						}
						else /* Internal error */
						{
							sutil.logf("Error writing reply to thread %s: %s", thread_id, err.toString());
							sutil.handle_500(request, response);
						}
					}
					else if(res === null) /* Thread not found - again, shouldn't really happen. 404 */
					{
						sutil.handle_404(request, response);
					}
					else /* Success - redirect to the page and location of the new post */
					{
						sutil.db.fetchThreadReplyCount(thread_id, function(n) {
							sutil.writeRedirect(response, base_url + ((n - 1) / replies_per_page));
						});
					}
			});
		});
	}
	else /* No POST - just show the thread */
	{
		sutil.db.fetchThread(thread_id, friendly_name, pagination_index, replies_per_page,
			function(err, thread) {
				if(err) /* Internal error */
				{
					sutil.logf("Error fetching thread %s: %s", thread_id, err.toString());
					sutil.handle_500(request, response);
				}
				else if(thread === null) /* 404 */
				{
					sutil.handle_404(request, response);
				}
				else /* Success - render the thread */
				{
					/* Render */
					sutil.writeSimpleResponse(response, renderer({
							"pagination_index": pagination_index,
							"page_count": Math.ceil(thread.reply_count / replies_per_page),
							"base_url": base_url,
							"content_parser": parser,
							"thread": thread
						})
					);
				}
			});
	}
};
