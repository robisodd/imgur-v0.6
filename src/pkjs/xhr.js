// ------------------------------------------------------------------------------------------------------------------------ //
//  Helper Functions
// ------------------------------------------------------------------------------------------------------------------------ //
var XHR_DOWNLOAD_TIMEOUT = 20000;  // Milliseconds until giving up on download

var XHR_LOG_NONE     = 0,   // No Logging
    XHR_LOG_ERRORS   = 1,   // Log errors
    XHR_LOG_SUCCESS  = 2,   // Log successes
    XHR_LOG_MESSAGES = 4,   // Log messages
    XHR_LOG_VERBOSE  = 255; // Log everything
// Note: Add together to log multiple things,
//   e.g.: SUCCESS + ERROR to log both successes and errors
//   Though don't add VERBOSE to anything

var xhrRequest = function (url, responseType, get_or_post, params, header, xhr_log_level, success, error) {
  if(xhr_log_level & XHR_LOG_MESSAGES) console.log('[XHR] Requesting URL: "' + url + '"');
  
  var request = new XMLHttpRequest();
  
 request.xhrTimeout = setTimeout(function() {
    if(xhr_log_level & XHR_LOG_ERRORS) console.log("[XHR] Timeout Getting URL: " + url);
    request.onload = null;  // Stopping a "fail then success" scenario
    error("[XHR] Timeout Getting URL: " + url);
  }, XHR_DOWNLOAD_TIMEOUT);  
  
  request.onload = function() {
    // got response, no more need for a timeout, so clear it
    clearTimeout(request.xhrTimeout); // jshint ignore:line
    
    if (this.readyState == 4 && this.status == 200) {
      if(!responseType || responseType==="" || responseType.toLowerCase()==="text") {
        if(xhr_log_level & XHR_LOG_SUCCESS) console.log("[XHR] Success: " + this.responseText);
        success(this.responseText);
      } else {
        if(xhr_log_level & XHR_LOG_SUCCESS) console.log("[XHR] Success: [" + responseType + " data]");
        success(this.response);
      }
    } else {
      if(xhr_log_level & XHR_LOG_ERRORS) console.log("[XHR] Error: " + this.responseText);
      error(this.responseText);
    }
  };
  
  request.onerror = function() {
    if(xhr_log_level & XHR_LOG_ERRORS) console.log("[XHR] Error: Unknown failure");
    error("[XHR] Error: Unknown failure");
  };

  var paramsString = "";
  if (params !== null) {
    for (var i = 0; i < params.length; i++) {
      paramsString += params[i];
      if (i < params.length - 1) {
        paramsString += "&";
      }
    }
  }

  if (get_or_post.toUpperCase() == 'GET' && paramsString !== "") {
    url += "?" + paramsString;
  }

  request.open(get_or_post.toUpperCase(), url, true);
  
  if (responseType)
    request.responseType = responseType;
  
  if (header !== null) {
    if(xhr_log_level & XHR_LOG_MESSAGES) console.log("[XHR] Header Found: "+ header[0] + " : "+ header[1]);
    request.setRequestHeader(header[0], header[1]);
  }

  if (get_or_post.toUpperCase() == 'POST') {
    request.send(paramsString);
  } else {
    request.send();
  }
};