# ssf

**sigkill's Simple Forum** - a piece of forum software written in Node.js,
running over HTTP with a MongoDB backend.

ssf is loosely inspired by the charmingly bad forum software hosted on [LetsRun.com](letsrun.com).

## Demo

As of 13/08/2015, a sample deployment of this server is running at [rcode.ca:27017](rcode.ca:27017).

## Dependencies

ssf depends on the **jade**, **bbcode-parser**, and **mongodb** Node.js libraries, and furthermore
requires a running mongod process to connect to (default `127.0.0.1:27017`).

## Quick Start

Install the necessary dependencies, insure that your mongod process is running,
then run `node main.js` and navigate to [127.0.0.1:32601](http://127.0.0.1:32601) in your browser.

## Project Directory Structure
`main.js` - entry point for the program, in which the DB and HTTP server are intialized
and requests are routed to the appropriate handlers.

`sutil.js` - internal utilities for the app, including but not limited to the database
backend (implemented as opaquely as possible).

`static/*` - static files to be served unchanged to the end user.

`templates/*.jade` - assorted templates representing pages and parts thereof.

`pages/*.js` - request handlers for the individual pages of the app.

## URL Structure
The feed of recent activity, a list of threads ordered by most to least recent,
is viewable at `/` or `/view-feed`. New threads can be written at `/author-thread`.
A thread can be viewed or replied to at `/view-thread`, but the specific URL is dependent
on the ID and title of the thread and hence each thread must be accessed from the feed.

## Schema
The MongoDB backend for ssf contains two collections, `threads` and `users`.

`threads` represents the set of forum posts and
contains `thread` objects. A `thread` object is:
```
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
```
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
```
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

## Licensing

This software is licensed under MIT-Zero, as indicated below:
```
The MIT-Zero License

Copyright (c) 2015 Adam `sigkill` Richardson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
