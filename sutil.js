/* For logf */
var format = require("util").format;

/* Basically console.log prepended with a datetime indicator */
module.exports.log = function() {
	cargs = ["[" + new Date().toShortString() + "]"];
	for(var i = 0; i < arguments.length; i ++)
		cargs.push(arguments[i]);

	console.log.apply(null, cargs);
};

/* A crappy printf clone, again prepended with a datetime indicator */
module.exports.logf = function() {
	console.log("[" + new Date().toShortString() + "] " + format.apply(null, arguments));
};

/* Since we need to log within this file as well */
var logf = module.exports.logf;

/* For 404 and 500 handlers. Both are static so we just precompile */
var jade = require("jade");
var not_found_text = new Buffer(jade.renderFile("templates/404.jade"));
var server_error_text = new Buffer(jade.renderFile("templates/500.jade"));

/* 500 handler */
module.exports.handle_500 = function(request, response) {
	response.writeHead(500, {"Content-Length": server_error_text.length, "Content-Type": "text/html"});
	response.end(server_error_text);
};

/* 404 handler */
module.exports.handle_404 = function(request, response) {
	response.writeHead(404, {"Content-Length": not_found_text.length, "Content-Type": "text/html"});
	response.end(not_found_text);
};

/* This idiom was popping up very frequently so I factored it out. Just a basic HTTP response */
module.exports.writeSimpleResponse = function(response, data, code, content_type) {
	code = code || 200;
	content_type = content_type || "text/html";

	response.writeHead(code, {"Content-Length": (data instanceof Buffer) ? data.length : Buffer.byteLength(data), "Content-Type": content_type});
	response.end(data);
};

/* Ditto. HTTP redirect */
module.exports.writeRedirect = function(response, url) {
	response.writeHead(303, {"Location": url});
	response.end();
};

/* Convenient addition to the Date class
 * We use this in our logging functions,
 * and also in view-feed and view-thread
 * This gets invoked in a few templates */
Date.prototype.toShortString = function() {
	var day = this.getDate().toString();
	if(day.length < 2) day = "0" + day;

	var month = this.getMonth().toString();
	if(month.length < 2) month = "0" + month;

	var year = this.getFullYear().toString();

	var hour = this.getHours().toString();
	if(hour.length < 2) hour = "0" + hour;

	var minute = this.getMinutes().toString();
	if(minute.length < 2) minute = "0" + minute;

	var second = this.getSeconds().toString();
	if(second.length < 2) second = "0" + second;

	/* Looks like 14/12/1995 13:37:00 */
	return day + "/" + month + "/" + year + " " + hour + ":" + minute + ":" + second;
};

/* Backend stuff below */

/* FriendlyError is an error class meant to hold a human-readable error message
 * suitable to be delivered to the end user. We use it here to indicate an error
 * arising from user data rather than an internal Mongo problem;
 * non-Friendly errors won't generally be shown to the end user */
function FriendlyError(message)
{
	this.message = message;
}
FriendlyError.prototype.toString = function(){ return this.message; };

/* These error constants are thrown by the santize function below;
 * We don't actually need a stack trace and the error objects won't be modified anywhere
 * so there's no point in constructing them every time */
const emptyNickError = new FriendlyError("Nickname can't be empty");
const longNickError = new FriendlyError("Nickname can't exceed 12 characters");
const charsetNickError = new FriendlyError("Nickname must be alphanumeric only");
const longPasswordError = new FriendlyError("Password can't exceed 32 characters");
const emptyTitleError = new FriendlyError("Title can't be empty");
const longTitleError = new FriendlyError("Title can't exceed 200 characters");
const longContentError = new FriendlyError("Reply content can't exceed 4000 characters");
const authBlankError = new FriendlyError("Nickname is registered; password required");
const authWrongError = new FriendlyError("Wrong password for registered nickname");

/* This function performs sanity checks on all user input,
 * returning one of the aforementioned FriendlyErrors if there is a problem,
 * or true if the input is sane. */
function sanitize(nickname, password, title, content)
{
	/* It's futile to check for empty content - how long is "[b][/b]"? */
	if(nickname.length <= 0) return emptyNickError;
	if(nickname.length > 12) return longNickError;
	if(password.length > 32) return longPasswordError;
	if(title.length <= 0) return emptyTitleError;
	if(title.length > 200) return longTitleError;
	if(content.length > 4000) return longContentError;

	/* Nickname must be alphanumeric. No restriction on the other fields */
	for(var i = nickname.length; i -- > 0;)
	{
		var c = nickname.charCodeAt(i);
		if(!((48 <= c && c <= 57) || (65 <= c && c <= 90) || (97 <= c && c <= 122)))
		{
			return charsetNickError;
		}
	}

	return true;
}

/* The original friendly name code was super buggy and vulnerable.
 * Silly of me to let it in in the first place
 * This purges out anything other than a - z, 0 - 9, and dashes */
function getFriendlyName(title)
{
	var f = title.toLowerCase().split(" ").slice(0, 10).join("-").replace(/[^a-z0-9-]/g, '');

	/* No empty friendly names */
	return f ? f : "-";
}


/* Mongo driver */
var mongodb = require("mongodb");

/* URL for mongod */
const mongo_url = "mongodb://127.0.0.1:27017/ssf";

/* DB connection, threads collection, users collection */
var connection;
var threads;
var users;

/* authenticate - checks a nickname against the user DB, creating a user record if none exists
 * callback is of the form fn(err) - err will be null for successful authentication,
 * a FriendlyError for failed authentication, or some internal error */
function authenticate(nickname, password, callback)
{
	/* Seek a given nickname */
	users.findOne(
		{"nickname": nickname},
		function(err, record) {
			if(err) /* Internal error */
			{
				callback(err);
			}
			else if(record === null) /* No such nickname in DB, yet */
			{
				if(password) /* If there was a password, register */
				{
					users.insert(
						{"nickname": nickname, "password": password},
						function(err, res) {
							if(err) callback(err);
							else
							{
								logf("Successfully inserted %s:'%s' into user DB", nickname, password);
								callback(null);
							}
						});
				}
				else callback(null); /* Success */
			}
			else
			{
				if(password)
				{
					if(password === record.password)
						callback(null); /* Success */
					else
						callback(authWrongError); /* Failure */
				}
				else callback(authBlankError); /* Failure */
			}
		});
}

/* db namespace */
module.exports.db = {
	/* See above */
	"FriendlyError": FriendlyError,

	/* connect - must be called before any other db function
	 * Connects to the mongo server, sets up any necessary indices,
	 * and initialize the relevant internal variables
	 * callback is of the form fn(err) */
	connect: function(callback) {
		mongodb.MongoClient.connect(mongo_url, function (err, con) {
			if(err)
			{
				callback(err);
			}
			else
			{
				/* Initialize internals */
				connection = con;
				threads = connection.collection("threads");
				users = connection.collection("users");

				/* Creating these indices should be free */
				threads.createIndex({"last_reply_time": 1});
				users.createIndex({"nickname": 1});

				callback(null);
			}
		});
	},

	/* fetchThreadCount - counts the total number of threads
	 * callback is of the form fn(err, n) */
	fetchThreadCount: function(callback) {
		threads.count({}, callback);
	},

	/* fetchFeed - fetches an array of obects containing a
	 * feed of recent posts from most to least recent, according to
	 * the pagination parameters provided. callback is of the form
	 * fn(err, feed_array) */
	fetchFeed: function fetchFeed(page_index, results_per_page, callback) {
		threads.find(
			{}, /* Select all threads */

			/* Select information relevant to a newsfeed-type structure */
			{
				"_id": true,
				"title": true,
				"friendly_name": true,
				"last_reply_nickname": true,
				"last_reply_time": true,
				"reply_count": true
			},

			/* Select the appropriate segment of the thread stream and sort from most to least recent */
			{
				"limit": results_per_page,
				"skip": page_index * results_per_page,
				"sort": [["last_reply_time", -1]]
			},

			/* Stuff it into an array. We presume that the data involved is small */
			function(err, result) {
				if(err)
					callback(err, null);
				else
					result.toArray(callback);
			}
		);
	},

	/* fetchThread - fetches a set of replies from a particular thread,
	 * according to the thread ID and the pagination information provided
	 * callback is of the form fn(err, thread); the entire thread structure
	 * is yielded, but only the relevant segment of the reply array is included */
	fetchThread: function(thread_id, friendly_name, pagination_index, replies_per_page, callback) {
		/* If the ID is mangled it's a 404 */
		try
		{
			var id = new mongodb.ObjectID(thread_id);
		}
		catch(e)
		{
			callback(null, null);
			return;
		}

		/* Pick out the thread with the given ID and friendly name,
		 * but only including relevant portions of the reply array */
		threads.findOne(
			{"_id": id, "friendly_name": friendly_name},
			{"replies": {"$slice": [pagination_index * replies_per_page, replies_per_page]}},
			callback);
	},

	/* fetchThreadReplyCount - fetches the number of replies for a given thread
	 * callback is of the form fn(err, n) */
	fetchThreadReplyCount: function(thread_id, callback) {
		/* If the ID is mangled it's a 404 */
		try
		{
			var id = new mongodb.ObjectID(thread_id);
		}
		catch(e)
		{
			callback(e, null);
			return;
		}

		/* Select reply count for a given ID */
		threads.findOne(
			{"_id": id},
			{"reply_count": true},
			function(err, result) {
				if(err || !result) callback(err, null);
				else callback(null, result.reply_count);
			});
	},

	/* createThread - creates a thread
	 * callback is of the form fn(err, t), where t is
	 * the inserted thread */
	createThread: function(nickname, password, title, content, callback) {
		/* Trim whitespace. I debated doing this in the request handler,
		 * but I think it's a sane policy for the backend itself as well */
		nickname = nickname.trim();
		password = password.trim();
		title = title.trim();
		content = content.trim();

		/* Sanitize and authenticate */
		var e = sanitize(nickname, password, title, content);
		if(e !== true)
		{
			callback(e, null);
		}
		else authenticate(nickname, password, function(err) {
			if(err)
			{
				callback(err, null);
			}
			else
			{
				var now = new Date();

				/* Insert. Pass along the inserted record */
				threads.insertOne({
					"title": title,
					"friendly_name": getFriendlyName(title),
					"last_reply_nickname": nickname,
					"last_reply_time": now,
					"reply_count": 1,
					"replies": [{
						"nickname": nickname,
						"time": now,
						"title": title,
						"content": content}]},
					function(err, result) {
						if(err) callback(err, null);
						else callback(null, result.ops[0]);
					});
			}
		});
	},

	/* createReply - authors a reply to a given thread
	 * callback is of the form fn(err, new_reply_count),
	 * in order to allow pagination to be shifted to the final page */
	createReply: function(thread_id, nickname, password, title, content, callback) {
		/* Trim whitespace */
		nickname = nickname.trim();
		password = password.trim();
		title = title.trim();
		content = content.trim();

		/* Sanitize */
		var e = sanitize(nickname, password, title, content);

		if(e !== true)
		{
			callback(e, null);
		}
		else authenticate(nickname, password, function(err) {
			if(err)
			{
				callback(err, null);
			}
			else
			{
				var now = new Date();

				/* If the ID is mangled, it's a 500,
				 * because this can only happen from deliberate tampering*/
				try
				{
					var id = new mongodb.ObjectID(thread_id);
				}
				catch(e)
				{
					new Error("Mangled ID in createReply");
					return;
				}
				
				/* Update thread */
				threads.update(
					{"_id": id}, /* Select by ID. We don't use friendly_name, though we could */
					{
						/* Increment the reply count
						 * I've read that this idiom is preferable to referencing the array length */
						"$inc": {"reply_count": 1},

						/* Push new post onto the array */
						"$push": {"replies": {
							"nickname": nickname,
							"time": now,
							"title": title,
							"content": content}},

						/* Update "most recent" stats */
						"$set": {"last_reply_time": now, "last_reply_nickname": nickname}
					},

					/* Pull out the reply count and dispatch it to the callback */
					function(err, result) {
						if(err) callback(err, null);
						else threads.findOne(
							{"_id": id},
							{"reply_count": true},
							function(err, result) {
								if(err) callback(err, result);
								else callback(null, result.reply_count);
							});
					});
			}
		});
	},

	/* close - probably never gets called as this is crash-only software
	 * Closes the connection to MongoDB */
	close: function() {
		connection.close(function(err) {
			if(err) logf("Failed to close MongoDB connection: %s", err.toString());
		});
	}
};
