
var fs = require('fs');
var Computer = require('./computer');
var join = require('path').join;
var debug = require('debug')('computer:worker');

if (!process.env.COMPUTER_ISO) {
  console.log('You must specify the ENV variable `COMPUTER_ISO` ' +
      'to location of iso file to broadcast.');
  process.exit(1);
}

if (!process.env.COMPUTER_IMG) {
  console.log('Must specificy the ENV variable `COMPUTER_IMG` ' +
    'to location of disk image to use');
  process.exit(1);
}

process.title = 'socket.io-computer-emulator';

// redis
var redis = require('./redis').emu();
var sub = require('./redis').emu();
var io = require('socket.io-emitter')(redis);

// iso
var iso = process.env.COMPUTER_ISO;
if ('/' != iso[0]) iso = join(process.cwd(), iso);
debug('iso %s', iso);

// img
var img = process.env.COMPUTER_IMG;
if ('/' != img[0]) img = join(process.cwd(), img);
debug('img %s', img);

var saveInterval = null;

// load computer emulator
var emu;

function load(){
  debug('loading emulator');
  emu = new Computer();

  emu.on('error', function() {
    console.log(new Date + ' - restarting emulator');
    emu.destroy();
    setTimeout(load, 1000);
  });

  emu.on('frame', function(frame) {
    io.emit('frame', frame);
    redis.set('computer:frame', frame);
  });

  emu.init(img, iso);
  emu.run();
  save();

  function save() {
    if (saveInterval) {
      debug('will save in %d', saveInterval);
      emu.snapshot('xpsnapshot.img');
      setTimeout(save, saveInterval);
    }
  }
}

sub.subscribe('computer:keydown');
sub.on('message', function(channel, key){
  if ('computer:keydown' != channel) return;
  emu.key(key.toString());
});

load();