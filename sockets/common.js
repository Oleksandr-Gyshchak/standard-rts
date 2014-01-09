var constants = require('../constants');
var realtime = require('../realtime');
var util = require('../util');

exports.sendServerStatus = function(socket, serverId, redact) {
  var serverStatus = realtime.serverStatus[serverId];

  if (!serverStatus) {
    return;
  }

  var result = {};

  var prop;

  for (prop in serverStatus) {
    if (serverStatus.hasOwnProperty(prop)) {
      result[prop] = serverStatus[prop];
    }
  }

  // Redact sensetive player info
  if (redact) {
    var origPlayers = serverStatus.players;
    result.players = [];

    var i;
    var j;
    var player;
    for (i = 0; i < origPlayers.length; ++i) {
      player = {};

      for (j = 0; j < constants.PLAYER_PROPERTY_WHITELIST.length; ++j) {
        prop = constants.PLAYER_PROPERTY_WHITELIST[j];

        player[prop] = origPlayers[i][prop];
      }

      result.players.push(player);
    }
  }

  socket.emit('server-status', result);
};

exports.handleStreamData = function(error, data, socket, name, prepareLine) {
  if (error) {
    socket.emit('mc-connection-lost');
    return;
  }

  var line;
  if (data.one) {
    line = prepareLine(data.one.line);
    
    if (line) {
      socket.emit(name, {
        line: line
      });
    }
  } else if (data.batch) {
    var i = data.batch.length;
    while (i--) {
      line = prepareLine(data.batch[i]);
      
      if (line) {
        data.batch[i] = line;
      } else {
        data.batch.splice(i, 1);
      }
    }
    
    socket.emit(name, {
      batch: data.batch
    });
  }
};