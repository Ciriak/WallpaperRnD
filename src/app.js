const electron = require('electron');
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

app.on('ready', function(){
  createSplashScreen();
});
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('ready', () => {
  const {protocol} = require('electron');
  protocol.registerFileProtocol('tagifier', (request, callback) => {
    console.log(request);
    const url = request.url.substr(7);
    callback({path: path.normalize(__dirname + '/' + url)});
  }, (error) => {
    if (error)
      console.error('Failed to register protocol');
  });
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (splashScreen === null) {
    createWindow();
  }
});


//
// Create the splashscreen
//
// Also check for update -> Pre-render the app -> show the app

function createSplashScreen () {
  splashScreen = new BrowserWindow({
    width: 300,
    height: 300,
    show:false,
    resizable : false,
    frame:false,
    icon: __dirname + '/web/img/tgf/icon_circle.png'
  });

  splashScreen.loadURL(`file://${__dirname}/web/splash.html`);

  splashScreen.once('ready-to-show', () => {
    splashScreen.show();
    splashScreen.webContents.send("tgf_version",{version:pjson.version});
    splashScreen.webContents.send("splash_message",{message:"Checking for update..."});

    //check for updates
    let options = {
      repo: 'Cyriaqu3/tagifier',
      currentVersion: pjson.version
    }

    const updater = new GhReleases(options);

    // Check for updates
    // `status` returns true if there is a new update available
    console.log("Looking for update");
    updater.check((err, status) => {
      if(err){
        ipc.emit("splach_message",{message:err});
        console.log(err);
      }

      if(status){
        console.log("Status :");
        console.log(status);
      }

      if (status) {
        ipc.emit("splach_message",{message:"Downloading update..."});
        // Download the update
        updater.download();

        //no update available, prepare the mainWindow
      } else {
        if(err){
          splashScreen.webContents.send("splash_message",{message:err.message});
        }

        mainWindow = new BrowserWindow({
          show:false,
          width: 1024,
          height: 600,
          minWidth: 1024,
          icon: __dirname + '/web/img/tgf/icon_circle.png'
        });
        mainWindow.loadURL(`file://${__dirname}/web/index.html`);
        //display the main app and close the
        mainWindow.once('ready-to-show', () => {
          splashScreen.close();
          mainWindow.show();
          mainWindow.focus();
        });
      }
    });

    // When an update has been downloaded
    updater.on('update-downloaded', (info) => {
      ipc.emit("splach_message",{message:"Installing update..."});
      // Restart the app and install the update
      updater.install()
    })

    // Access electrons autoUpdater
    updater.autoUpdater

  });

  splashScreen.on('closed', function () {
    splashScreen = null
  });
}
