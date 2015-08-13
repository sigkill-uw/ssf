var dblib = require("./dblib.js");

var iface = require("readline").createInterface({
	input: process.stdin,
	output: process.stdout
});

var format = require("util").format;

Command = function(desc, arg_desc, fn) {
	this.desc = desc;
	this.arg_desc = arg_desc;
	this.fn = fn;
};

var commands = [];

dblib.connect(function(err, db) {
	if(err) throw err;

	//for(var i = 0; i < 100; i ++)
		//dblib.createThread(db, "The Quick Brown Fox Jumps Over the Lazy Dogs " + i.toString(), "Adem", "This a test post", function(){});

	console.log("ssf Command Line Tool");

	commands.push(new Command("View Feed", [], function(args, next) {
		dblib.fetchFeed(db, 0, 9999999, function(err, data){ console.log(data); next(); }); 
	}));

	commands.push(new Command("Create Thread", ["Title", "Poster", "Content"], function(args, next) {
		dblib.createThread(db, args[0], args[1], args[2], function(err, data) {
			console.log("New thread:", data);
			next();
		});
	}));

	commands.push(new Command("View Thread", ["Thread ID"], function(args, next) {
		dblib.fetchThread(db, args[0], 0, 99999999, function(err, data) {
			console.log(err); console.log(data);
			next();
		});
	}));

	commands.push(new Command("Create Post", ["Thread ID", "Title", "Poster", "Content"],
		function(args, next) {
			dblib.createPost(db, args[0], args[1], args[2], args[3], function(err, data) {
				console.log(data);
				next();
			});
		}));

	commands.push(new Command("Exit", [], function(args, next) {
		dblib.close(db);
		process.exit();
	}));

	for(var i = 0; i < commands.length; i ++)
		console.log(format("[%d] %s", i, commands[i].desc));
	console.log();

	var active_command = NaN;
	var buffered_input = [];
	var prompt = "?"

	function receive(line)
	{
		if(isNaN(active_command))
		{
			active_command = parseInt(line);
			if(active_command < 0 || active_command >= commands.length || isNaN(active_command))
			{
				active_command = NaN;
				prompt = "?";
			}
			else
			{
				buffered_input = [];
				prompt = (commands[active_command].arg_desc.length > 0) ?
							commands[active_command].arg_desc[0] : "?";
			}
		}
		else
		{
			buffered_input.push(line.trim());
			prompt = (buffered_input.length >= commands[active_command].arg_desc.length) ?
						"?" : commands[active_command].arg_desc[buffered_input.length];
		}

		if(!isNaN(active_command) && buffered_input.length === commands[active_command].arg_desc.length)
		{
			commands[active_command].fn(buffered_input, function(){ iface.question("[?] ", receive); });
			active_command = NaN;
			buffered_input = [];
		}
		else iface.question(format("[%s] ", prompt), receive);
	}

	iface.question(format("[%s] ", prompt), receive);
});
