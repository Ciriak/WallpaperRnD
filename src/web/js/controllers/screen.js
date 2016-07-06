app.controller('screenCtrl', function($scope, $rootScope,$state,$http,$stateParams)
{
  //retreive screens infos
  $scope.screens = $rootScope.remote.screen.getAllDisplays();
  console.log("Screen infos :");
  console.log($scope.screens);

  //retreive a list of wallpapers
  $http({
    method: 'GET',
    url: $rootScope.appProps.api.url
  }).then(function successCallback(r) {
    var wp = r.data.data;
    for (var i = 0; i < wp.length; i++) {
      wp[i].cover.large_image_url = wp[i].cover.medium_image_url.replace("/medium/","/large/");
    }
    $scope.wallpapers = wp;
  }, function errorCallback(r) {
    console.log("Unable to communicate with the API");
  });

  //index = screen index
  $scope.setWallpaper = function(uri, index){
    if(!index){
      index = 0;
    }
    $rootScope.ipc.emit("setWallpaper",{uri : uri, screen : index});
  }
});
