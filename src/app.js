const electron = require('electron');
const wallpaper = require('wallpaper');
var http = require('http');
var fs = require('fs');
var request = require('request');
var Jimp = require("jimp");
var async = require("async");
const {app} = require('electron');
const Menu = electron.Menu;
const BrowserWindow = electron.BrowserWindow;
const GhReleases = require('electron-gh-releases');
const ipc = electron.ipcMain;
const path = require('path');
const storage = require('electron-json-storage');
let splashScreen
let mainWindow
let displays
let wallpapers
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

  //retreive the screens and add aditionnal infos on the screens
  displays = processDisplays(electron.screen.getAllDisplays());

  //retreive the saved wallpapers
  storage.get('wallpapers', function(error, data) {
    if (error) throw error;
    wallpapers = data;
  });

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 700,
    icon: __dirname + '/web/img/ui/icon_black.png'
  });

  mainWindow.loadURL(`file://${__dirname}/web/index.html`);
});

ipc.on('setWallpaper', function (data) {
  //download the image locally
  downloadImage(data,function(imagePath){
    //init the wallpaper (and use the previously downloaded images)
    initWallpaper(function(err){
      if(err){
        return;
      }
      //add the image to the full wallpaper and save it locally
      processImage(imagePath, data.screen, function(err){
        if(err){
          return;
        }
        //set the new updated wallpaper
        setWallpaper(function(success){
          if(success){
            console.log("done");
          }
        });
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
  let displays = electron.screen.getAllDisplays();
  displays.maxHeight = 0;
  displays.maxWidth = 0;
  //set the max dimensions
  for (var i = 0; i < displays.length; i++) {
    if(displays[i].size.width > displays.maxWidth){
      displays.maxWidth = displays[i].size.width;
    }
    if(displays[i].size.height > displays.maxHeight){
      displays.maxHeight = displays[i].size.height;
    }
  }

  //set the size
  wallpapers.height = displays.maxHeight;
  for (var i = 0; i < displays.length; i++) {
    wallpapers.width += displays[i].size.width;
  }

  //generate the empty template
  console.log("displays");
  console.log(wallpapers);
  var image = new Jimp(wallpapers.width, wallpapers.height, 0x000000, function (err, image) {
    if(err){
      console.log(err);
      return callback(err, null);
    }
    image.write( "wallpaper.jpg", function(){
        console.log("Wallpaper template generated :");
    });

    //add previously added img to the template

    if(wallpapers.screens){
      console.log("Adding the previously added screens...");
      // assuming openFiles is an array of file names
      async.forEachOf(wallpapers.screens, function (process, index, cb) {

          // Perform operation on file here.
          console.log('Process for ' + process);
          processImage(process.path, index, function(err){
            if(err){
              return cb(err);
            }
            return cb();
          });

      }, function(err) {
          if( err ) {
            console.log('A file failed to process');
            callback(err, "wallpaper.jpg");
          } else {
            console.log('All files have been processed successfully');
            callback(null, "wallpaper.jpg");
          }
      });
    }else{
      console.log("Empty template generated");
      callback(null, "wallpaper.jpg");
    }
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
        return callback(err, null);
      }
      image.cover( displays[screen].size.width, displays[screen].size.width );
      // move left the image depending of it index and the others screens size
      wallpaper.blit( image, displays[screen].imageX ,0 ).write("wallpaper.jpg",function(){
        //return no error
        callback(null);
      });
    });
  });
};

function processDisplays(displays){
  var globalX = 0;
  for (var i = 0; i < displays.length; i++) {
    displays[i].imageX = globalX;
    globalX += displays[i].size.width;
  }
  return displays;
}

function downloadImage(data, callback){
  var imagePath = "wallpaper"+data.screen+path.extname(data.uri);
  download(data.uri,imagePath,function(){

    //save the image path in localstorage
    if(!wallpapers.screens){
      wallpapers["screens"] = [];
    }

    wallpapers.screens[data.screen] = {
      path : imagePath
    }

    storage.set('wallpapers', wallpapers, function(error) {
      if (error) throw error;
      callback(imagePath);
    });
  });
}
