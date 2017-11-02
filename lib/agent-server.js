module.exports = AgentServer;

var debug = require('debug')('mocha-fork:agent-server');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var socketIO = require('socket.io');
var https = require('https');
var pem = require('pem');

function AgentServer(options) {
  options = options || {};
  Object.defineProperty(this, 'securityToken', {
    value: options.securityToken
  });
  Object.defineProperty(this, 'groups', {
    value: options.groups || ['any']
  });
  Object.defineProperty(this, 'host', {
    value: options.host || '0.0.0.0'
  });
  Object.defineProperty(this, 'port', {
    value: options.port || 59595
  });
  Object.defineProperty(this, 'key', {
    value: options.key || null,
    writable: true
  });
  Object.defineProperty(this, 'cert', {
    value: options.cert || null,
    writable: true
  });
  Object.defineProperty(this, 'sockets', {
    value: []
  });
}

util.inherits(AgentServer, EventEmitter);

AgentServer.prototype.start = start;
AgentServer.prototype.stop = stop;

AgentServer.prototype._ensureCertificate = _ensureCertificate;
AgentServer.prototype._startServer = _startServer;
AgentServer.prototype._configureServer = _configureServer;
AgentServer.prototype._onConnection = _onConnection;
AgentServer.prototype._onDisconnect = _onDisconnect;
AgentServer.prototype._onAction = _onAction;
AgentServer.prototype._killAllProcesses = _killAllProcesses;

function start() {
  var _this = this;
  return new Promise(function (resolve, reject) {
    debug('start()');

    if (!_this.securityToken) return reject(
      new Error('agent-server [opts] missing securityToken')
    );

    _this._ensureCertificate()
      .then(function () {
        return _this._startServer();
      })
      .then(function () {
        return _this._configureServer();
      })
      .then(function () {
        debug('started ok');
        resolve();
      })
      .catch(reject);
  });
}

function stop() {
  var _this = this;
  return new Promise(function (resolve, reject) {

    if (_this.server) _this.server.close();
    console.log('TODO: close all sockets');
    resolve();

  });
}

function _ensureCertificate() {
  var _this = this;
  return new Promise(function (resolve, reject) {
    if (this.key && this.cert) return resolve();

    debug('_ensureCertificate()');
    pem.createCertificate({
      selfSigned: true
    }, function (err, keys) {
      if (err) return reject(err);

      debug('created certificate');
      _this.key = keys.serviceKey;
      _this.cert = keys.certificate;
      resolve();
    });
  });
}

function _startServer() {
  var _this = this;
  return new Promise(function (resolve, reject) {
    debug('_startServer()');

    function onListenError(err) {
      reject(err);
    }

    function onRunningError(err) {
      _this.emit('error', err);
    }

    function onListening() {
      var addr = _this.server.address();
      debug('started server %s:%d', addr.address, addr.port);
      _this.server.removeListener('error', onListenError);
      _this.server.on('error', onRunningError);
      resolve();
    }

    _this.server = https.createServer({
      key: _this.key,
      cert: _this.cert
    }, function (req, res) {
      res.writeHead(200);
      res.end('OK');
    });

    _this.io = socketIO(_this.server);
    _this.server.on('error', onListenError);
    _this.server.on('listening', onListening);
    _this.server.listen(_this.port, _this.host);
  });
}

function _configureServer() {
  var _this = this;
  return new Promise(function (resolve, reject) {
    debug('_configureServer()');

    _this.io.on('error', function (err) {
      _this.emit('error', err);
    });

    _this.io.on('connection', _this._onConnection.bind(_this));

    resolve();
  });
}

function _onConnection(socket) {
  var _this = this;
  debug('_onConnection() %s', socket.id);

  if (socket.handshake.query.token !== this.securityToken) {
    return socket.disconnect(true);
  }

  this.sockets.push(socket);

  socket.on('disconnect', function () {
    _this._onDisconnect(socket);
  });

  socket.on(socket.id, function (action) {
    _this.onAction(socket, action);
  });

  socket.emit('info', {
    id: socket.id,
    groups: this.groups
  });
}

function _onDisconnect(socket) {
  debug('_onDisconnect() %s', socket.id);
  this.sockets.splice(this.sockets.indexOf(socket), 1);
  this._killAllProcesses(socket);
}

function _onAction(socket, action) {
  console.log('ACTION', action);
}

function _killAllProcesses(socket) {

}