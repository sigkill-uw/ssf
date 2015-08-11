# ssf

*sigkill's Simple Forum* - a piece of forum software written in Node.js,
running over HTTP with a MongoDB backend.

ssf is loosely inspired by the charmingly bad forum software hosted on [LetsRun.com](letsrun.com).

## Dependencies

ssf depends on the *jade*, *bbcode-parser*, and *mongodb* Node.js libraries, and furthermore
requires a running mongod process to connect to (default `127.0.0.1:27017`).

## Quick Start

Install the necessary dependencies, insure that your mongod process is running,
then run `node main.js` and navigate to [127.0.0.1:32601](http://127.0.0.1:32601) in your browser.

## Schema
The MongoDB backend for ssf contains two collections, `threads` and `users`.

`threads` represents the set of forum posts and
contains `thread` objects. A `thread` object is:
```javascript
{
	_id: ObjectID,

	title: string,
	friendly_name: string,

	last_reply_nickname: string,
	last_reply_time: date,

	reply_count: integer,
	replies: array of reply
}
```
A `reply` object is
```javascript
{
	nickname: string,
	time: string,

	title: string,
	content: string
}
```
`threads` is indexed by both `_id` and `last_reply_time`.

`users` represents the set of registered users
and contains `user` objects. A `user` object is
```javascript
{
	nickname: string,
	password: string
}
```
`users` is indexed by `nickname`.

## Shortcomings

ssf was primarily written as a learning experience rather than as a piece of
practical real-world software. As of this release, it lacks any sort of
administration/moderation interface, and furthermore has no built-in mechanism
to report, flag, or hide objectionable posts.
