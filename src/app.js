const electron = require('electron');
const wallpaper = require('wallpaper');
var http = require('http');
var fs = require('fs');
var request = require('request');
var Jimp = require("jimp");
const {app} = require('electron');
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const GhReleases = require('electron-gh-releases');
const ipc = electron.ipcMain;
let splashScreen
let mainWindow
//retreive package.json properties
var pjson = require('./package.json');

console.log("Wallpaper V."+pjson.version);


// Hook the squirrel update events
if (handleSquirrelEvent()) {
  // squirrel event handled and app will exit in 1000ms, so don't do anything else
  return;
}

function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      // Optionally do things such as:
      // - Add your .exe to the PATH
      // - Write to the registry for things like file associations and
      //   explorer context menus

      // Install desktop and start menu shortcuts
      spawnUpdate(['--createShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      // Undo anything you did in the --squirrel-install and
      // --squirrel-updated handlers

      // Remove desktop and start menu shortcuts
      spawnUpdate(['--removeShortcut', exeName]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      // This is called on the outgoing version of your app before
      // we update to the new version - it's the opposite of
      // --squirrel-updated

      app.quit();
      return true;
  }
};

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('ready', () => {
  let displays = electron.screen.getAllDisplays();
  console.log(displays);
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    icon: __dirname + '/web/img/ui/icon_black.png'
  });

  mainWindow.loadURL(`file://${__dirname}/web/index.html`);
});

ipc.on('setWallpaper', function (data) {
  initWallpaper(function(err){
    if(err){
      return;
    }
    processImage(data.uri, data.screen, function(err){
      if(err){
        return;
      }
      setWallpaper(function(success){
        if(success){
          console.log("done");
        }
      });
    });
  });
});


var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};


//
//  Generate a wallpaper empty template using the current screen config
//
var initWallpaper = function(callback){
  var wallpaper = {
    maxWidth : 0,
    maxHeight: 0,
    width: 0,
    height : 0
  };

  let displays = electron.screen.getAllDisplays();
  //set the max dimensions
  for (var i = 0; i < displays.length; i++) {
    if(displays[i].size.width > wallpaper.maxWidth){
      wallpaper.maxWidth = displays[i].size.width;
    }
    if(displays[i].size.height > wallpaper.maxHeight){
      wallpaper.maxHeight = displays[i].size.height;
    }
  }

  //set the size
  wallpaper.height = wallpaper.maxHeight;
  for (var i = 0; i < displays.length; i++) {
    wallpaper.width += displays[i].size.width;
  }

  //generate the empty template
  var image = new Jimp(wallpaper.width, wallpaper.height, 0x000000, function (err, image) {
    if(err){
      console.log(err);
      callback(err, null);
    }
    image.write( "wallpaper.jpg", function(){
        console.log("Wallpaper template generated :");
        console.log(wallpaper);
    });
    callback(null, "wallpaper.jpg");
  });
};

var setWallpaper = function(callback){
  wallpaper.set("wallpaper.jpg").then(() => {
    callback(true);
  });
}

//uri = path of the image
//screen = index of the screen

var processImage = function(uri, screen, callback){
  let displays = electron.screen.getAllDisplays();
  console.log("processing");
  console.log(uri);
  //retreive the wallpaper template
  Jimp.read("wallpaper.jpg",function (err,wallpaper){
    if(err){
      console.log(err);
      callback(err, null);
    }
    //load the image
    Jimp.read(uri,function (err,image){
      if(err){
        console.log(err);
        callback(err, null);
      }
      image.cover( displays[screen].size.width, displays[screen].size.height );
      wallpaper.blit( image, 0 ,0 ).write("wallpaper.jpg",function(){
        //return no error
        callback(null);
      });
    });
  });


};
