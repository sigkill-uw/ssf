var fs = require("fs");
var sutil = require("../sutil.js");

var word;

function random_post()
{
	post = {};

	post.nickname = word().replace(/\W/g, '').substring(0, 12);

	post.title = [];
	for(var i = Math.max(1, Math.ceil(Math.random() * 10)); i --;)
		post.title.push(word());
	post.title = post.title.join(" ").substring(0, 200);

	post.content = [];
	for(var i = Math.ceil(Math.random() * 300); i --;)
		post.content.push(word());
	post.content = post.content.join(" ").substring(0, 4000);

	return post;
}

sutil.db.connect(function(err) {
	if(err) throw err;

	fs.readFile("tst/words", function(err, data) {
		if(err) throw err;
		var words = data.toString().split("\n");
		word = function(){ return words[Math.floor(Math.random() * words.length)]; };

		var i = 10000;

		var populateThreads = function() {
			if(i <= 0)
			{
				return;
			}

			i --;

			var post = random_post();
			sutil.db.createThread(post.nickname, "", post.title, post.content,
				function(err, thread) {
						if(err)
						{
							console.log(err);
							populateThreads();
						}

						var j = Math.ceil(Math.random() * 1000);

						var createReplies = function() {
							if(j <= 0)
							{
								populateThreads();
								return;
							}

							j --;

							var reply = random_post();
							sutil.db.createReply(thread._id, reply.nickname, "", reply.title, reply.content,
								function(err, res) {
									if(err) console.log(err);
									createReplies();
								});
						};

						createReplies();
				});
		};

		populateThreads();
	});
});
