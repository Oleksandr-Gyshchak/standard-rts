var constants = require('../constants');
var realtime = require('../realtime');
var util = require('../util');

exports.sendServerStatus = function(socket, serverId) {
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

  var i;
  var player;
  var nicknameMap = {};
  for (i = 0; i < serverStatus.players.length; ++i) {
    player = serverStatus.players[i];
    if (player.nickname) {
      nicknameMap[player.uuid] = player.nickname;
    }
  }

  var socketId;
  var connection;
  for (socketId in realtime.connections) {
    if (realtime.connections.hasOwnProperty(socketId)) {
      connection = realtime.connections[socketId];
      if (connection.uuid && nicknameMap[connection.uuid]) {
        connection.nickname = nicknameMap[connection.uuid];
      } else if (connection.nickname) {
        delete connection.nickname;
      }
    }
  }

  // Redact sensetive player info for non superusers
  if (!socket.isSuperuser) {
    var whitelist;

    if (socket.isModerator) {
      whitelist = constants.PLAYER_PROPERTY_MODERATOR_WHITELIST;
    } else {
      whitelist = constants.PLAYER_PROPERTY_WHITELIST;
    }

    var origPlayers = serverStatus.players;
    result.players = [];

    var j;
    for (i = 0; i < origPlayers.length; ++i) {
      player = {};

      for (j = 0; j < whitelist.length; ++j) {
        prop = whitelist[j];

        player[prop] = origPlayers[i][prop];
      }

      result.players.push(player);
    }
  }

  var redactAddress = !socket.isSuperuser && !socket.isModerator;
  realtime.getActiveWebChatUsers(redactAddress, function(err, users) {
    result.users = users;

    socket.emit('server-status', result);
  });
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