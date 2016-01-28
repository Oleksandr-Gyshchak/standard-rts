var common = require('./common')
  , streams = require('../streams')
  , realtime = require('../realtime')
  , util = require('../util');

var chatRegexPat = /\[\*WC\*\]/;
var consoleChatRegexStripPat = /\[\*CWC\*\]/;

var urlpat = /(\w*\.?\w+\.[\w+]{2,3}[\.\/\?\w&=\-]*)/;
var boldPat = /\<\/?b\>/g;

exports.start = function(io, apis) {
  io
  .of('/console')
  .on('connection', function(socket) {
    socket.on('auth', function(data) {
      socket.removeAllListeners('auth');
      realtime.authorize(socket, data, true, false, function(err, userId, username, uuid, isSuperuser, isModerator) {
        if (err) {
          console.log(err);
          return;
        }

        var serverId = data.serverId;
        var api = apis[serverId];

        if (!api) {
          socket.emit('unauthorized');
          return;
        }

        realtime.addConnection(socket, 'console');

        streams.addListener(socket.id, serverId, 'console', function(error, data) {
          common.handleStreamData(error, data, socket, 'console', function(line) {
            if (line.match(chatRegexPat)) {
              return null;
            }

            line = line.replace(consoleChatRegexStripPat, '');

            // Encode '<' and '>'
            line = util.htmlEncode(line);

            // Convert ansi color to html
            line = util.ansiConvert.toHtml(line);

            // Strip out bold tags
            line = line.replace(boldPat, '');

            // Linkify possible urls
            line = line.replace(urlpat, '<a href="http://$1" target="_blank">$1</a>');

            return line;
          });
        });

        var statusInterval = setInterval(function() {
          common.sendServerStatus(socket, serverId);
        }, 1000);

        socket.on('console-input', function(data) {
          if (data.message) {
            api.call('server_say', {'message': data.message});
          } else if (data.command) {
            api.call('runConsoleCommand', data.command);
          }
        });

        socket.on('set-donator', function(data) {
          var id;
          for (id in apis) {
            if (apis.hasOwnProperty(id)) {
              apis[id].call('runConsoleCommand', 'permissions player addgroup ' + data.uuid + ' donator');
            }
          }
        });

        socket.on('disconnect', function() {
          streams.removeListeners(socket.id);
          realtime.removeConnection(socket);
          clearInterval(statusInterval);
        });
      });
    });
  });
};