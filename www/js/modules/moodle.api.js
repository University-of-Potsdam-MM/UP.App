"use strict";

define([
  'jquery',
  'underscore',
  'backbone',
  'utils'
], function( $, _, Backbone, utils) {

  var moodleAPI = {
    BaseURL: 'http://api.uni-potsdam.de/endpoints/moodleAPI/1.0',
  };

  function cors_post(url, params) {
    console.log(url, params);
    return $.ajax( url, {
      type: "POST",
      crossDomain: true,
      data: params,
      beforeSend: function (request) {
          request.withCredentials = true;
          request.setRequestHeader("Authorization", utils.getAuthHeader());
      },
    }).fail(function(jqXHR, textStatus){
      // TODO: Handle Errors
      if(textStatus == 'timeout'){
        console.log('timeout error');
      }
      console.log(textStatus, jqXHR);
    });
  }

  var BasicAPI = Backbone.Model.extend({

    login_url: moodleAPI.BaseURL + '/login/token.php',
    webservice_url: moodleAPI.BaseURL + '/webservice/rest/server.php',

    authorize: function(){
      // TODO wait until authorization or throw error
      var params = _.pick(this.attributes, 'username', 'password', 'service');
      var api = this;

      var deferred = $.Deferred();
      deferred.then(
        cors_post(this.login_url, params).then(function(data){
          // console.log('success get_token', arguments);
          // console.log(data);
          api.set(data);
          api.unset('password'); // remove password

          if (data['error']) {
            api.set(data);
            api.trigger('error');
            deferred.rejectWith(data);
          } else {
            api.set('wstoken', data['token']);
            // you shouldn't listen on this one,
            // because it is triggered for each authenticated service
            api.trigger('authorized');
            deferred.resolveWith(data);
          }
        })
      );

      return deferred.promise();
    },

    isAuthorized: function(){
      if (this.has('wstoken')) {
        // TODO if token works to fetch UserId, then we are authorized
        return true;
      } else {
        return false;
      }
    },

    createWsFunction: function(wsfunction, paramNames){
      var api = this;
      api[wsfunction] = function(params) {
        paramNames = _.union(paramNames, ['wsfunction','wstoken','moodlewsrestformat']);
        var ws = {'wsfunction': wsfunction, 'wstoken': api.get('token')};
        var postParams = _.pick(_.extend(api.attributes, params, ws), paramNames);

        return cors_post(api.webservice_url, postParams).promise();
      }
    },
  });


  moodleAPI.api = new (BasicAPI.extend({

    initialize: function(){
      this.createWsFunction('moodle_webservice_get_siteinfo',[]);
      this.createWsFunction('moodle_enrol_get_users_courses',['userid']);
      this.createWsFunction('core_course_get_contents',['courseid']);
    },

    authorizeAndGetUserId: function(){
      var api = this;
      return api.authorize().then(function(){
        if (api.isAuthorized()) {
          return api.fetchUserid();
        }
      });
    },

    fetchUserid: function(){
      var api = this;
      var params = {
        moodlewsrestformat:'json',
        wstoken: this.get('token'),
        wsfunction:'moodle_webservice_get_siteinfo',
      };
      return cors_post(this.webservice_url, params)
        .then(function(data){
          // console.log('fetchUserid', arguments);
          api.set(data);
        })
        .promise();
    },
  }))({
    // username: undefined,     // <= set this from the login page
    // password: undefined,     // <= set this from the login page
    service:'moodle_mobile_app',
    moodlewsrestformat:'json',
  });
/*
  moodleAPI.news_api = new (BasicAPI.extend({
    initialize: function(){
      this.createWsFunction('webservice_get_latest_coursenews',[]);
    },
  }))({
    // username: undefined,     // <= set this from the login page
    // password: undefined,     // <= set this from the login page
    service:'webservice_coursenews',
    moodlewsrestformat:'json',
  });
*/

  return moodleAPI;
});