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
logf = module.exports.logf;

/* Convenient addition to the Date class
 * We use this in our logging functions,
 * and also in view-feed and view-thread */
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
function FriendlyError(message, http_code)
{
	this.message = message;
	this.http_code = http_code ? http_code : 200;
}
FriendlyError.prototype.toString = function(){ return this.message; };

/* These error constants are thrown by the santize function below;
 * We don't actually need a stack trace and the error objects won't be modified anywhere
 * so there's no point in constructing them every time */
const emptyNickError = new FriendlyError("Nickname can't be empty");
const longNickError = new FriendlyError("Nickname can't exceed 20 characters");
const charsetNickError = new FriendlyError("Nickname must be alphanumeric only");
const longPasswordError = new FriendlyError("Password can't exceed 32 characters");
const longTitleError = new FriendlyError("Reply title can't exceed 200 characters");
const emptyContentError = new FriendlyError("Content can't be empty");
const longContentError = new FriendlyError("Reply content can't exceed 4000 characters");

/* Another FriendlyError for a mangled or non-existant thread _id */
const noSuchIDError = new FriendlyError("The requested thread couldn't be found", 404);

/* This function performs sanity checks on all user input,
 * returning one of the aforementioned FriendlyErrors if there is a problem,
 * or true if the input is sane. */
function sanitize(nickname, password, title, content)
{
	/* Check length */
	if(nickname.length <= 0) return emptyNickError;
	else if(nickname.length > 20) return longNickError;
	else
	{
		/* Accept alphanumeric only */
		nickname = nickname.toLowerCase();
		for(var i = 0; i < nickname.length; i ++)
			if("abcdefghijklmnopqrstuvwxyz0123456789".indexOf(nickname[i]) === -1)
				return charsetNickError;
	}

	if(password.length > 32)
		return longPasswordError;

	if(title.length > 200)
		return longTitleError;

	if(content.length <= 0)
		return emptyContentError;

	if(content.length > 4000)
		return longContentError;

	return true;
}

/* TODO */
function authenticate(nickname, password, callback)
{
	callback(null);
}

/* Driver */
var mongodb = require("mongodb");

/* URL for mongod */
const mongo_url = "mongodb://127.0.0.1:27017/ssf";

/* DB connection, threads collection, users collection */
var connection;
var threads;
var users;

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
	fetchThread: function(thread_id, pagination_index, replies_per_page, callback) {
		/* If the ID is mangled it's a 404 */
		try
		{
			var id = new mongodb.ObjectID(thread_id);
		}
		catch(e)
		{
			callback(noSuchIDError, null);
			return;
		}

		threads.findOne(
			{"_id": id},
			{"replies": {"$slice": [pagination_index * replies_per_page, replies_per_page]}},
			callback);
	},

	/* createThread - creates a thread
	 * callback is of the form fn(err, id), where id is
	 * the object ID of the inserted thread */
	createThread: function(nickname, password, title, content, callback) {
		var e = sanitize(nickname, password, title, content);
		if(e !== true)
		{
			callback(e, null);
		}
		else authenticate(nickname, password, function(err) {
			var now = new Date();
			var friendly_name = encodeURIComponent(title.toLowerCase().
								replace("/", "").
								replace("\\", "").
								split(" ").
								slice(0, 10).
								join("-"));

			threads.insertOne({
				"title": title,
				"friendly_name": friendly_name,
				"last_reply_nickname": nickname,
				"last_reply_time": now,
				"reply_count": 1,
				"replies": [{
					"nickname": nickname,
					"time": now,
					"title": title,
					"content": content}]},
				function(err, record) {
					if(err) callback(err, null);
					else callback(null, record.insertedId);
				});
		});
	},

	/* createReply - authors a reply to a given thread
	 * callback is of the form fn(err, new_reply_count),
	 * in order to allow pagination to be shifted to the final page */
	createReply: function(thread_id, nickname, password, title, content, callback) {
		var e = sanitize(nickname, password, title, content);

		if(e !== true)
		{
			callback(e, null);
		}
		else authenticate(nickname, password, function(err) {
			var now = new Date();

			/* If the ID is mangled it's a 404
			 * This can only happen deliberately I think */
			try
			{
				var id = new mongodb.ObjectID(thread_id);
			}
			catch(e)
			{
				callback(noSuchIDError, null);
				return;
			}
				

			threads.update(
				{"_id": id},
				{
					"$inc": {"reply_count": 1},
					"$push": {"replies": {
						"nickname": nickname,
						"time": now,
						"title": title,
						"content": content}},
					"$set": {"last_reply_time": now, "last_reply_nickname": nickname}
				},
				{},
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
