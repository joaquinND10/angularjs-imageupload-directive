angular.module('imageupload', [])
  .factory('getResizeArea', function(){
    return function () {
      var resizeAreaId = 'fileupload-resize-area';

      var resizeArea = document.getElementById(resizeAreaId);

      if (!resizeArea) {
        resizeArea = document.createElement('canvas');
        resizeArea.id = resizeAreaId;
        resizeArea.style.visibility = 'hidden';
        document.body.appendChild(resizeArea);
      }

      return resizeArea;
    }
  })
  .factory("resizeImage", function(getResizeArea){
    return function (origImage, options) {
      var maxHeight = options.resizeMaxHeight || 300;
      var maxWidth = options.resizeMaxWidth || 250;
      var quality = options.resizeQuality || 0.7;
      var cover = options.cover || options.cover == "" || false;
      var coverHeight = options.coverHeight || 300;
      var coverWidth = options.coverWidth || 250;
      var coverX = options.coverX || 'left';
      var coverY = options.coverY || 'top';
      var type = options.resizeType || 'image/jpg';

      var canvas = getResizeArea();

      var height = origImage.height;
      var width = origImage.width;

      var imgX = 0;
      var imgY = 0;

      if(!cover){
        // calculate the width and height, constraining the proportions
        if (width > height) {
	  if (width > maxWidth) {
	    height = Math.round(height *= maxWidth / width);
	    width = maxWidth;
	  }
        } else {
	  if (height > maxHeight) {
	    width = Math.round(width *= maxHeight / height);
	    height = maxHeight;
	  }
        }

        canvas.width = width;
        canvas.height = height;

      }else{
        // Logic for calculating size when in cover-mode
        canvas.width = coverHeight;
        canvas.height = coverWidth;
        // Resize image to fit canvas and keep original proportions
        var ratio = 1;
        if(height < canvas.height)
        {
	  ratio = canvas.height / height;
	  height = height * ratio;
	  width = width * ratio;
        }
        if(width < canvas.width)
        {
	  ratio = canvas.width / width;
	  height = height * ratio;
	  width = width * ratio;
        }

        // Check if both are too big -> downsize
        if(width > canvas.width && height > canvas.height)
        {
	  ratio = Math.max(canvas.width/width, canvas.height/height);
	  height = height * ratio;
	  width = width * ratio;
        }

        // place img according to coverX and coverY values
        if(width > canvas.width){
	  if(coverX === 'right'){ imgX = canvas.width - width; }
	  else if (coverX === 'center'){ imgX = (canvas.width - width) / 2; }
        }else if(height > canvas.height){
	  if(coverY === 'bottom'){ imgY = canvas.height - height; }
	  else if (coverY === 'center'){ imgY = (canvas.height - height) / 2; }
        }

      }

      //draw image on canvas
      var ctx = canvas.getContext("2d");
      ctx.drawImage(origImage, imgX, imgY, width, height);

      // get the data from canvas as 70% jpg (or specified type).
      return canvas.toDataURL(type, quality);
    }
  })
  .factory('fileToDataURL', function($q) {
    return function (file) {
      var deferred = $q.defer();
      var reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = function (e) {
        deferred.resolve(e.target.result);
      };
      reader.onerror = function(e){
        deferred.reject(e);
      };
      reader.onabort = function(e){
        deferred.reject(e);
      };

      return deferred.promise;
    };
  })
  .factory('createImage',function($q){
    return function(url) {
      var deferred = $q.defer();
      var image = new Image();
      image.src = url;
      image.onload = function() {
        deferred.resolve(image);
      };
      image.onerror = function(e){
        deferred.reject(e);
      }
      return deferred.promise;
    };
  })
  .factory('doResizing', function($q, createImage, resizeImage){
    return function(imageResult, scope) {
      return createImage(imageResult.url)
        .then(function(image) {
          var dataURL = resizeImage(image, scope);
          var imageType = dataURL.substring(5, dataURL.indexOf(';'));
          imageResult.resized = {
            dataURL: dataURL,
            type: imageType
          };
          return imageResult
        });
    };
  })
  .factory("map", function(){
    return function(list, fn){
      return Array.prototype.map.call(list, fn);
    };
  })
  .directive('inputImages',  function($q, resizeImage, fileToDataURL, createImage, map) {
    'use strict'

    return {
      template: "<input type='file' accept='image/*' multiple>",
      restrict: 'E',
      require: "ngModel",
      link: function postLink(scope, element, attrs, ngModel) {

        element.bind('change', function (evt) {
          var files = evt.target.files;
          var imageFiles = files;

          //convert each file into an image/file object
          var model = map(files, function(imageFile){
            var file_obj = {
              file: imageFile,
              url: URL.createObjectURL(imageFile) //this is used to generate images/resize
            };
            return file_obj;
          });

          scope.$apply(function(){
            ngModel.$setViewValue(model);
          });
        });
      }
    };
  })
  .directive('inputImage',  function() {
    'use strict'

    return {
      template: "<input type='file' accept='image/*'>",
      restrict: 'E',
      require: "ngModel",
      link: function (scope, element, attrs, ngModel) {

        element.bind('change', function (evt) {
          var files = evt.target.files;
          var imageFile = files[0];
          var model = {
            file: imageFile,
            url: URL.createObjectURL(imageFile) //this is used to generate images/resize
          };

          scope.$apply(function(){
            ngModel.$setViewValue(model);
          });
        });
      }
    };
  })

  .directive('appendDataUri',  function(fileToDataURL, map, $q) {
    'use strict'

    function appendDataUri(model){
      return fileToDataURL(model.file)
        .then(function (dataURL) {
          model.dataURL = dataURL;
          return model;
        });
    }

    return {
      restrict: 'A',
      require: "ngModel",
      link: function (scope, element, attrs, ngModel) {

        var addDataUri = function() {

          var model = ngModel.$modelValue;

          // If the viewValue is invalid (say required but empty) it will be `undefined`
          if (angular.isUndefined(model)) return;

          if(angular.isArray(model)){
            var model_update_promises = map(model, appendDataUri);
            $q.all(model_update_promises)
              .then(function(updates){
                ngModel.$modelValue = updates;
              });
          }
          else{
            appendDataUri(model)
              .then(function(update){
                ngModel.$modelValue = update;
              });
          }

        };

        ngModel.$viewChangeListeners.push(addDataUri);
      }
    };
  })
.directive('resize',function($q, doResizing, map){
  'use strict'

  return {
    restrict: 'A',
    require: "ngModel",
    link: function (scope, element, attrs, ngModel) {

      function resize(attrs){
        return function(model){ return doResizing(model,attrs);}
      }

      var resizeImage = function() {

        var model = ngModel.$modelValue;

        if (angular.isUndefined(model) && angular.isUndefined(model.file)) return;

        if(angular.isArray(model)){
          var model_update_promises = map(model, resize(attrs));
          $q.all(model_update_promises)
            .then(function(updates){
              ngModel.$modelValue = updates;
            });
        }
        else{
          doResizing(model, attrs)
            .then(function(update){
              ngModel.$modelValue = update;
            });
        }

      };
      ngModel.$viewChangeListeners.push(resizeImage);
    }
  };
})
.directive('cover',function($q, doResizing, map){
  'use strict'

  return {
    restrict: 'A',
    require: "ngModel",
    link: function (scope, element, attrs, ngModel) {

      function resize(attrs){
        return function(model){ return doResizing(model,attrs);}
      }

      var resizeImage = function() {

        var model = ngModel.$modelValue;

        if (angular.isUndefined(model) && angular.isUndefined(model.file)) return;

        if(angular.isArray(model)){
          var model_update_promises = map(model, resize(attrs));
          $q.all(model_update_promises)
            .then(function(updates){
              ngModel.$modelValue = updates;
            });
        }
        else{
          doResizing(model, attrs)
            .then(function(update){
              ngModel.$modelValue = update;
            });
        }

      };
      ngModel.$viewChangeListeners.push(resizeImage);
    }
  };
});
