var app = angular.module('wallpaper', [
'ui.router',
'angular-electron'
    ]);

app.config(function($stateProvider, $urlRouterProvider) {
  //
  // For any unmatched url, redirect to /
  $urlRouterProvider.otherwise("/");
  //
  // Now set up the states
  $stateProvider
    .state('main', {
      url: "/",
      templateUrl: "views/index.html",
      reload:true
    });
});

app.filter("trustUrl", ['$sce', function ($sce) { //used by media player
    return function (recordingUrl) {
        return $sce.trustAsResourceUrl(recordingUrl);
    };
}]);

app.controller('mainCtrl', ['$scope', '$http','$rootScope','$window','$state', function($scope, $http,$rootScope,$window,$state)
{
  $rootScope.remote = require('electron').remote;
  $rootScope.ipc = $rootScope.remote.ipcMain;
  $rootScope.appProps = require('../package.json');
  console.log($rootScope.appProps);

    var Menu = $rootScope.remote.Menu;
    var MenuItem = $rootScope.remote.MenuItem;
    $rootScope.version = $rootScope.remote.app.getVersion();

    var template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New task',
            click : function() { $state.go('main'); }
          }
        ]
      },
      {
        label: 'About',
        role: 'about',
        submenu: [
          {
            label: 'Tagifier (v'+$rootScope.version+')'
          },
          {
            type: 'separator'
          },
          {
            label: 'Github page',
            click : function() { $rootScope.remote.shell.openExternal('https://github.com/Cyriaqu3/tagifier'); }
          },
          {
            label: 'Report an issue',
            click : function() { $rootScope.remote.shell.openExternal('https://github.com/Cyriaqu3/tagifier/issues/new'); }
          },
          {
            label: 'Facebook Page',
            click : function(){ $rootScope.remote.shell.openExternal('https://www.facebook.com/Tagifier-1172453299437404/'); }
          }
        ]
      }
    ];
    var menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

  $scope.docReady = false;
  $(window).load(function(){
    $scope.docReady = true;
    $scope.$apply();
  });

  $scope.ipc = $rootScope.remote.ipcMain;

  //auto focus the form
  $(document).hover(function(){
    $("#youtube-url").focus();
  });

  $(document).click(function(){
    $("#youtube-url").focus();
  });

  //retreive last commit infos
  $scope.lastCommit = "Tagifier";
  $http({
  	method: 'GET',
  	url: 'https://api.github.com/repos/CYRIAQU3/tagifier/commits'
	}).then(function successCallback(response) {
    	$scope.lastCommit = response.data[0].sha.substring(0,8);
    	$scope.lastUser = response.data[0].author.login;
  });

	// request permission for notifications (used when the file is ready)
  $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){
    //remove all the notifs when a page change
    $('.toast').remove();
  });
  $rootScope.$on('$stateChangeSuccess', function (event) {

  });

}]);

app.directive('targetBlank', function () {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          var href = element.href;
          if(true) {  // replace with your condition
            element.attr("target", "_blank");
          }
        }
    };
});
