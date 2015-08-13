/* Internal utilities */
var sutil = require("../sutil.js");

/* For post request */
var qs = require("querystring");

/* Corresponding template */
var renderer = require("jade").compileFile("templates/author_thread.jade");

/* Request handler */
module.exports.handle_request = function(params, request, response) {
	/* Defensive programming against sketchy URLs */
	if(params.length > 1)
	{
		sutil.handle_404(request, response);
	}
	else
	{
		/* POST request means we're creating a new thread */
		if(request.method == "POST")
		{
			/* Buffer and parse post data */
			var raw = "";
			request.on("data", function(chunk){ raw += chunk.toString(); })
			request.on("end", function() {
				var post_data = qs.parse(raw);

				/* Fill in any missing fields */
				if(!post_data.nickname) post_data.nickname = "";
				if(!post_data.password) post_data.password = "";
				if(!post_data.title) post_data.title = "";
				if(!post_data.content) post_data.content = "";

				/* Create a thread */
				sutil.db.createThread(
						post_data.nickname,
						post_data.password,
						post_data.title,
						post_data.content,
						function(err, res) {
							if(err)
							{
								/* Pass friendly errors onto the user - these display on the formm */
								if(err instanceof sutil.db.FriendlyError)
								{
									sutil.writeSimpleResponse(response, renderer({
										"form_error": err,

										/* Whatever he/she just typed */
										"cached_nickname": post_data.nickname,
										"cached_title": post_data.title,
										"cached_content": post_data.content}));
								}
								else /* Internal server error */
								{
									sutil.logf("Error authoring thread: %s", err.toString());
									sutil.handle_500(request, response);
								}
							}
							else /* Redirect to the new thread */
							{
								sutil.writeRedirect(response, "/view-thread/" + res._id + "/" + res.friendly_name);
							}
						});
				});
		}
		else
		{
			/* Just render the static interface */
			sutil.writeSimpleResponse(response, renderer());
		}
	}
};
