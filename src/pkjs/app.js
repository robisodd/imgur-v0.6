/*


  v0.3-20160710: Ok, starting fresh nnnnow...
                 Got image to scale
                 Created cropping function for "fill image" which causes some leftover image which needs to be cropped
                 Halved resolution until data is "small enough".  Pebble scales image up
                 Need to send "every 4th pixel" horizontally and vertically, building up image on pebble.
  
  v0.3-20160624: 
                 It's been a while, starting fresh.
              
                 
  v0.2-20160409: 
    Fixed Chunk Issue in 0.1
    Increased Chunk Size to 8000
    Got rid of creating Canvas (doesn't work on iPhone)
    Added separate zip.js, png.js, jpg.js to decode/encode the image in JS
    Scaling image to reduce size
    
    Known Issues:
      Need to vary chunk size depending on platform (Aplite/Color)
      Need to get this working on iPhones

v0.1-20160408:
    Known Issues:
      If The image size is an exact multiple of the chunk size, the last one doesn't trigger the creation of the image
      Need to signify final chunk, or better yet, we know the image size from the beginning.  Just calculate when it's done from that (or if a chunk is tiny).
  
      


*/
// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Includes
// ------------------------------
//var MessageQueue   = require('./MessageQueue.js');
//var MessageQueue   = require('message-queue-pebble/MessageQueue.js');
var MessageQueue   = require('message-queue-pebble');

var png = require('./png.js');
//var PebblePNG = require('./ppng/PebblePNG.js');
var PebblePNG = require('./PebblePNG.js');
//var watch_info = require('./watch_info.js');
var watch_info = require('watch_info');
var jpg = require('./jpg.js');

// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Constants
// ------------------------------
var DOWNLOAD_TIMEOUT = 20000;


watch_info.onDetect(function(){
  console.log('watch_info = ' + JSON.stringify(watch_info));
  if(watch_info.emulator)
    console.log("Emulator Detected: " + watch_info.model + " (" + watch_info.platform + ")");
  else
    console.log("Detected Pebble: " + watch_info.model + " (" + watch_info.platform + ")");

  // Make palette to be able to make PNG images to send to watch later
  PebblePNG.make_pebble_png_palette(watch_info.color);
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- //
// Modified from:  https://jsfiddle.net/gabrieleromanato/qaght/
// var Base64 = {
//     // base64url key, not standard base64 (I chagned it so it's URL compatible, so it won't expand to a bunch of %## with encodeURIComponent)
//     _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=",

//     encode: function(input) {
//         var output = "";
//         var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
//         var i = 0;
//         while (i < input.length) {
//             chr1 = input.charCodeAt(i++);
//             chr2 = input.charCodeAt(i++);
//             chr3 = input.charCodeAt(i++);

//             enc1 = chr1 >> 2;
//             enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
//             enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
//             enc4 = chr3 & 63;

//             if (isNaN(chr2))
//                 enc3 = enc4 = 64;
//             else if (isNaN(chr3))
//                 enc4 = 64;

//             output = output + this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) + this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);
//         }
//         return output;
//     },

//     decode: function(input) {
//         var output = [];//"";
//         var chr1, chr2, chr3;
//         var enc1, enc2, enc3, enc4;
//         var i = 0;
//         input = input.replace(/[^A-Za-z0-9\-\_\=]/g, "");
//         while (i < input.length) {
//             enc1 = this._keyStr.indexOf(input.charAt(i++));
//             enc2 = this._keyStr.indexOf(input.charAt(i++));
//             enc3 = this._keyStr.indexOf(input.charAt(i++));
//             enc4 = this._keyStr.indexOf(input.charAt(i++));

//             chr1 = (enc1 << 2) | (enc2 >> 4);
//             chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
//             chr3 = ((enc3 & 3) << 6) | enc4;
//           // Use this to output a string instead of a byte array:
//           //                  output = output + String.fromCharCode(chr1);
//           //  if (enc3 != 64) output = output + String.fromCharCode(chr2);
//           //  if (enc4 != 64) output = output + String.fromCharCode(chr3);
//                             output.push(chr1);
//             if (enc3 != 64) output.push(chr2);
//             if (enc4 != 64) output.push(chr3);
//         }
//         return output;
//     }
// };


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- //
// Send PNG to watch

// img.onload = function() {
//   MessageQueue.sendAppMessage({"message":"Converting PNG..."}, null, null);
//   canvas.width = 144;
//   canvas.height = 168;
//   ctx.drawImage( img, 0, 0 );
  
// 	var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // copies data
// 	var d = new Uint8ClampedArray(imageData.data.buffer); // d is a view (a pointer), doesn't copy data
//   var arr = [];
// 	for (var i = 0; i < d.length; i += 4) {
//     arr.push(d[i]);
//     arr.push(d[i+1]);
//     arr.push(d[i+2]);
//   }
  
//   var bitmap = generatePngForPebble(canvas.width, canvas.height, arr);
  
//   MessageQueue.sendAppMessage({"message":"Sending image..."}, null, null);
//   sendPNG(bitmap);
//   //MessageQueue.sendAppMessage({"message":"Image Sent!"}, null, null);
// };




// function sendPNGtoPebble(png) {
//   //var CHUNK_SIZE = 1500;
// //   var CHUNK_SIZE = 8000;
//   var CHUNK_SIZE = 587;
//   var i = 0;

//   MessageQueue.sendAppMessage({"JIGSAW_INIT": png.length});

//   var send_next_piece = function() {
//     if(i>=png.length) return;

//     var nextSize = png.length-i > CHUNK_SIZE ? CHUNK_SIZE : png.length-i;
//     var sliced = png.slice(i, i + nextSize);
//     MessageQueue.sendAppMessage({"JIGSAW_PIECE_INDEX":i, "JIGSAW_PIECE":sliced}, send_next_piece, null);  // Send piece and, if successful, call this function again to send next slice

//     console.log("Sending " + i + "/" + png.length);
//     i += nextSize;
//   };
  
//   send_next_piece();  // Send first slice
// }

function sendPNGtoPebble(png) {
  send_data_to_pebble_in_pieces(png, null, null);
}

function send_data_to_pebble_in_pieces(data, success_callback, error_callback) {
  var PIECE_MAX_SIZE = 500;
  var bytes = 0;
  var send_piece = function(message) {
    //message = message || {};
    if(bytes >= data.length) {
      console.log("Done! (" + bytes + "/" + data.length + ")");
      success_callback && success_callback();
      return;
    }
    var piece_size = data.length - bytes > PIECE_MAX_SIZE ? PIECE_MAX_SIZE : data.length - bytes;
    var piece = data.slice(bytes, bytes + piece_size);
    console.log("Sending " + bytes + "/" + data.length);
    // Send piece and if successful, call this function again to send next piece
    message.JIGSAW_PIECE_INDEX = bytes;
    message.JIGSAW_PIECE       = piece;
    MessageQueue.sendAppMessage(message, function(){send_piece({});}, error_callback);
    bytes += piece_size;
  };
  send_piece({"JIGSAW_INIT": data.length});
}




Pebble.addEventListener("ready", function(e) {
  console.log("PebbleKit JS Has Started!");
  MessageQueue.sendAppMessage({"MESSAGE":"Press Select To GO!"}, null, null);
});



var imgur_list = [];
var image_index = 0;
var number_of_images = 0;
var fit_image = false;  // TRUE=fit the image to screen (whitespace) VS FALSE=fill the screen with image (lose part of image)

//number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/XxuliYk.jpg"});  // Force a single image for testing
//number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/ETHlrDE.jpg"});  // Force a single image for testing
//number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/QG7XPL1m.png"});  // Force a single image for testing
// png.js:188 "Uncaught Error: Incomplete or corrupt PNG file" when loading gif as png
////number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/6ZHDTyK.png"});  // Force a single image for testing
//number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/8GePWAt.png"});  // Force a single image for testing
//number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/vQoH1lW.png"});  // Force a single image for testing
// number_of_images = 1;  imgur_list.push({link: "http://i.imgur.com/fphsJB3.png"});  // Force a single image for testing
//number_of_images = 1;  imgur_list.push({link: "https://maps.googleapis.com/maps/api/staticmap?maptype=map&center=42.3314300,-83.0457500&zoom=16&size=144x168"});  // Force a single image for testing

var url;
url = "https://api.imgur.com/3/gallery/r/pics/top/day";
url = "https://api.imgur.com/oauth2/authorize?response_type=pin";
url = "https://api.imgur.com/3/gallery/r/pebble/";
url = "https://api.imgur.com/3/gallery/r/nsfw/top/day";
url = "https://api.imgur.com/3/gallery/r/aww/top/day";
// url = "https://api.imgur.com/3/gallery/r/pokemongo/top/day";

Pebble.addEventListener("appmessage", function(e) {
  if(number_of_images>0) {
    send_random_image();
  } else {
    console.log("Getting Imgur Array...");
    MessageQueue.sendAppMessage({"MESSAGE":"Getting Image List..."}, null, null);
    getImgurURL(url);
  }
});

// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Imgur Gallery Functions
// ------------------------------------------------------------------------------------------------------------------------------------------------ //
function getImgurURL(url_to_get) {
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.onreadystatechange=function() {
    if (xmlhttp.readyState == 4)
      //	if(xmlhttp.status == 200) {
      parse_response(xmlhttp.responseText);
    //	} else {
    //		console.log("xmlHttp Error: " + xmlhttp.status);
    //	}
  };
  xmlhttp.open("GET", url_to_get, true);
  xmlhttp.setRequestHeader("Authorization", "Client-id 66a8ef745e3bedd");  // My super secret code!  Shh, don't tell anyone!
  xmlhttp.send();
}

function parse_response(response) {
	var parsed_response = JSON.parse(response);
	
	if(parsed_response.success) {
		imgur_list = parsed_response.data; // data is needed for response
    number_of_images = imgur_list.length;
    console.log("Initial Image List Length: " + number_of_images);
    remove_unusable_images_from_imgur_list();
    number_of_images = imgur_list.length;
    console.log("Pruned Image List Length: " + number_of_images);
    if(number_of_images>0) {
      send_random_image();
    } else {
      console.log("No images left to show!");
    }
	} else {
		console.log("Error " + parsed_response.status + ": " + parsed_response.data.error);
	}
}

function remove_unusable_images_from_imgur_list() {
  for(var i = 0; i < imgur_list.length;) {
    try {
      var ratio = (imgur_list[i].width > imgur_list[i].height) ? imgur_list[i].width / imgur_list[i].height : imgur_list[i].height / imgur_list[i].width;
      if(imgur_list[i].animated !== false)
        delete_element(i, "Animated");
      else if(ratio > 3)  // RATIO of 3 is good for basalt/aplite, less for chalk
        delete_element(i, "Ratio=" + ratio);
      else if(imgur_list[i].nsfw === true)
        delete_element(i, "NSFW");
      else
        i++;
    } catch (e) {
      console.log("Error removing unusable images.  Image " + i + ": " + JSON.stringify(e));
    }
	}
}

function delete_element(index_to_delete, reason) {
  console.log("Removing image " + index_to_delete + ": " + reason);
	imgur_list.splice(index_to_delete, 1);
	number_of_images = imgur_list.length;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ //

function send_random_image() {
  MessageQueue.sendAppMessage({"MESSAGE":"Downloading image..."}, null, null);
  image_index = Math.floor(Math.random() * number_of_images);  // Pick a random image
  getImageThumbnail(image_index);
}


// Get the thumbnail image from imgur
function getImageThumbnail(index_to_get) {
  if((imgur_list.length > 0) && (index_to_get < imgur_list.length)) {
    console.log("Getting Image: " + imgur_list[index_to_get].link);
    var image_url = imgur_list[index_to_get].link;	// The Full Size Image

    var n = image_url.lastIndexOf(".");
    var ext = image_url.slice(n).toUpperCase();
    //ext=".PNG";
    console.log("Extension = '"+ext+"'");

    var get_thumbnail = true;
    if(get_thumbnail) {
      // The Medium Thumbnail (320x320 or close to)
      // Also, thumbnails on imgur are always jpg
      image_url = image_url.slice(0, n) + "m.jpg";
      console.log("Getting Thumbnail: " + image_url);
      getJpegImage(image_url);
    } else {
      switch (ext) {
        case ".PNG":
          getPngImage(image_url);
          break;
        case ".JPG":
        case ".JPEG":
          getJpegImage(image_url);
      }
    }
  } else {
    console.log("Index bigger than array!");
  }
}


function getPngImage(url){
  var xhrTimeout = setTimeout(function() {
    console.log("PNG Download Error: Timeout Getting URL: " + url);
    //MessageQueue.sendAppMessage({"message":"Error : Timeout"}, null, null);
  }, DOWNLOAD_TIMEOUT);

  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  
  xhr.onload = function() {
    // got response, no more need for a timeout, so clear it
    clearTimeout(xhrTimeout); // jshint ignore:line
    console.log("Received PNG!  Decoding...");
//     MessageQueue.sendAppMessage({"message":"Decoding image..."}, null, null);

//     var data    = new Uint8Array(xhr.response);
//     var png3     = new PNG(data);  // jshint ignore:line
//     var palette = png3.palette;
//     var pixels  = png3.decodePixels();
    
    var data    = new Uint8Array(xhr.response);
    console.log("data = " + data[0] + ", " + data[1] + ", " + data[2] + ", " + data[3]);
    var png3    = png(data);
    console.log("PNG Data: " + png3.width + "w x " + png3.height + "h");
    console.log("PNG Length: " + png3.data.length);
    
//     prepare_and_send_image_to_pebble(png3.data, png3.width, png3.height);
    sendPNGtoPebble(PebblePNG.generate(png3.width, png3.height, png3.data));
    
  };

  xhr.send(null);
}


function getJpegImage(url){
  var xhrTimeout = setTimeout(function() {
    console.log("JPG Download Error: Timeout");
    //MessageQueue.sendAppMessage({"message":"Error : Timeout"}, null, null);
  }, DOWNLOAD_TIMEOUT);

  var jpg2 = new jpg();
  
  jpg2.onload = function() {
    // got response, no more need for a timeout, so clear it
    clearTimeout(xhrTimeout); // jshint ignore:line
    console.log("Received JPG!  Decoding...");
    
    console.log("JPG size: " + jpg2.width + "w x " + jpg2.height + "h");
    var pixels = jpg2.getData(jpg2.width, jpg2.height);
    
    
    var i, k, r, g, b;
    var data = new Uint8Array(jpg2.width * jpg2.height * 4);  // * 4 since each pixel is RGBA
    i = k = 0;
    while (i < data.length) {
      r = data[i++] = pixels[k++];
      g = data[i++] = pixels[k++];
      b = data[i++] = pixels[k++];
      data[i++] = 255;
    }
    
    
    
    prepare_and_send_image_to_pebble(data, jpg2.width, jpg2.height);
  };

  try{
    jpg2.load(url);
  }catch(e){
    console.log("JPG Load Error: " + e);
  }
}



// ----------------------------------------------------------------------------------------------------------------------------------
//  Image Manipulation Functions
// ------------------------------
function prepare_and_send_image_to_pebble(pixels, image_width, image_height) {
  var bytes_per_pixel =  Math.round(pixels.length / (image_width * image_height));  // Shouldn't need to round, but just being safe
  console.log("bytes per pixel = " + bytes_per_pixel);
  
  /*
  // Shrink image until it's small enough
  var out_width = 144 * 2, out_height = 168 * 2;
  var png2;
  do {
    out_height = Math.round(out_height/2); out_width = Math.round(out_width / 2);
    png2 = convertImage(pixels, bytes_per_pixel, image_width, image_height, out_width, out_height);
    console.log("Current Size: " + png2.length);
  } while (png2.length > 2000);
  */
  
  
  var zoom = 1; // bigger zoom = blockier
  var out_width  = 144 / zoom;
  var out_height = 168 / zoom;
  var png2;
  png2 = convertImage(pixels, bytes_per_pixel, image_width, image_height, out_width, out_height);
  console.log("Current Size: " + png2.length);

  sendPNGtoPebble(png2);
  
  //sendPNGtoPebble(generatePngForPebble(image_width, image_height, pixels));
}





function convertImage(rgbaPixels, bytes_per_pixel, image_width, image_height, output_width, output_height) {
  var output_pixel_buffer = new ArrayBuffer(image_width*image_height*4);  // jshint ignore:line
  var output_array = new Uint8ClampedArray(output_pixel_buffer);

  //console.log("bytes_per_pixel = " + bytes_per_pixel);
  //var ratio = Math.min(144 / width,168 / height);
  //var ratio = Math.min(ratio,1);  // Disallow enlarging

//   var final_width = Math.floor(width * ratio);
//   var final_height = Math.floor(height * ratio);
  var png_for_pebble = [];
  
  console.log("Starting convertImage() = " + image_width + "w x " + image_height + "h");
	var ratio = ((output_width / image_width) < (output_height / image_height));
	console.log("ratio = " + ratio);
  
	if(fit_image)
		ratio = !ratio;

  var w, h;
	if(ratio) {
		w = (image_width * (output_height / image_height));
		h = output_height;
	} else {
		w = output_width;
		h = (image_height * (output_width / image_width));
	}

// 	var shrink_to_fit = true;  // Shrink canvas to fit image (false for testing)
// 	if(fit_image && shrink_to_fit) {  // Only shrink canvas if fit_image, else enlarges canvas
// 		output.width  = w;
// 		output.height = h;
// 	}
  
  w = Math.round(w);
  h = Math.round(h);
	console.log("output dimensions = " + w + "w x " + h + "h");
  
  console.log("gonna scale image");
  ScaleRect(output_array, rgbaPixels, image_width, image_height, w, h, bytes_per_pixel);
  
  console.log("gonna brighten image");
  rob_brightness_contrast(output_array, -10, 10, bytes_per_pixel);
  
  console.log("Gonna dither image");
  rob_atkinson_dither(output_array, w, bytes_per_pixel);
  
  console.log("Cropping image (" + w + "x" + h + ") to Pebble screen (" + output_width + "x" + output_height + ")");
  var size = rob_crop_image(output_array, w, h, output_width, output_height, bytes_per_pixel);
  console.log("New cropped image size: " + size.w + "w x " + size.h + "h");
  
  console.log("Generatin' PNG fer pebbles");
  png_for_pebble = PebblePNG.generate(size.w, size.h, output_array);

  
//   if(watch_info.platform === 'aplite') {
//     var grey_pixels = greyScale(rgbaPixels, width, height, bytes_per_pixel);
//     ScaleRect(final_pixels, grey_pixels, width, height, final_width, final_height, 1);
//     floydSteinberg(final_pixels, final_width, final_height, pebble_nearest_color_to_black_white);
//     bitmap = toPBI(final_pixels, final_width, final_height);
//   }
//   else {
//     ScaleRect(final_pixels, rgbaPixels, width, height, final_width, final_height, bytes_per_pixel);
// //     floydSteinberg(final_pixels, final_width, final_height, pebble_nearest_color_to_pebble_palette);
//     png_for_pebble = generatePngForPebble(final_width, final_height, final_pixels);
//   }

  return png_for_pebble;
}


// Scaline & ScaleRect algorithms from : http://www.compuphase.com/graphic/scale.htm 

function ScaleLine(Target, Source, SrcWidth, TgtWidth, offset_target, offset_source, bytes_per_pixel) {
  var NumPixels = TgtWidth;
  var IntPart = Math.floor(SrcWidth / TgtWidth);
  var FractPart = SrcWidth % TgtWidth;
  var E = 0;

  var i_target = offset_target;
  var i_source = offset_source;

  while (NumPixels-- > 0) {
    for(var i=0; i<bytes_per_pixel; i++)
      Target[bytes_per_pixel*i_target + i] = Source[bytes_per_pixel*i_source + i];
    i_target++;
    i_source += IntPart;
    E += FractPart;
    if (E >= TgtWidth) {
      E -= TgtWidth;
      i_source ++;
    } /* if */
  } /* while */
}

function ScaleRect(Target, Source, SrcWidth, SrcHeight, TgtWidth, TgtHeight, bytes_per_pixel) {
  var NumPixels = TgtHeight;
  var IntPart = Math.floor(SrcHeight / TgtHeight) * SrcWidth;
  var FractPart = SrcHeight % TgtHeight;
  var E = 0;

  var i_target = 0;
  var i_source = 0;

  while (NumPixels-- > 0) {
    ScaleLine(Target, Source, SrcWidth, TgtWidth, i_target, i_source, bytes_per_pixel);
    //PrevSource = Source;  // rob: commented this out cause it doesn't seem to do anything? 20160710

    i_target += TgtWidth;
    i_source += IntPart;
    E += FractPart;
    if (E >= TgtHeight) {
      E -= TgtHeight;
      i_source += SrcWidth;
    } /* if */
  } /* while */
}


function rob_brightness_contrast(image_data, brightness, contrast, bytes_per_pixel) {
// Brightness = [-100 to 100] and Contrast = [-100 to 100]
	var bAdjust, cAdjust;
	bAdjust = Math.floor(100 * (brightness / 100));
	cAdjust = (contrast + 100) / 100;
	cAdjust = cAdjust * cAdjust;

	for (var i = 0; i < image_data.length; i += bytes_per_pixel) {
    for (var rgb = 0; rgb < 3; rgb++) {
      image_data[i + rgb] += brightness;                        // Brightness
      image_data[i + rgb] = (image_data[i + rgb] - 128) * cAdjust + 128; // Contrast
    }
	}
}


function rob_atkinson_dither(image_data, image_width, bytes_per_pixel) {
	var r, g, b, approx_r, approx_g, approx_b, affected_pixel;
  var r_part = 0, g_part = 1, b_part = 2;
  
  var image_data_width = bytes_per_pixel * image_width;
  
  for (var source_pixel = 0; source_pixel < image_data.length; source_pixel +=bytes_per_pixel) {

    approx_r = (image_data[source_pixel + r_part] >>> 6) * 85;
    approx_g = (image_data[source_pixel + g_part] >>> 6) * 85;
    approx_b = (image_data[source_pixel + b_part] >>> 6) * 85;

    r = (image_data[source_pixel + r_part] - approx_r) >> 3;
    g = (image_data[source_pixel + g_part] - approx_g) >> 3;
    b = (image_data[source_pixel + b_part] - approx_b) >> 3;

    // diffuse the error for three colors
    affected_pixel = source_pixel + bytes_per_pixel;     // 1 pixel right of our pixel
    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    affected_pixel += bytes_per_pixel;        // 1 more pixel right
    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    affected_pixel = source_pixel + image_data_width;  // 1 pixel down from our pixel
    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    affected_pixel += bytes_per_pixel;        // 1 down, 1 right
    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    affected_pixel += bytes_per_pixel;        // 1 down 2 right
    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    affected_pixel = source_pixel + image_data_width + image_data_width + bytes_per_pixel + bytes_per_pixel;  // 2 down, 2 right

    image_data[affected_pixel + r_part] += r;
    image_data[affected_pixel + g_part] += g;
    image_data[affected_pixel + b_part] += b;

    // draw pixel
    image_data[source_pixel + r_part] = approx_r;
    image_data[source_pixel + g_part] = approx_g;
    image_data[source_pixel + b_part] = approx_b;
  }
}


function robAtkinsonDitherBW(d, w, bytes_per_pixel) {
  var r, g, b, y, n;
  w = bytes_per_pixel * w;
  for (var i = 0; i < d.length; i += bytes_per_pixel) {

    r = d[i    ];
    g = d[i + 1];
    b = d[i + 2];
    y = ((r+r+r+b+g+g+g+g)>>>10)*255;

    r = (r - y) >> 3;
    g = (g - y) >> 3;
    b = (b - y) >> 3;

    // Diffuse the error for three colors
    n = i + bytes_per_pixel;
    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    n += bytes_per_pixel;
    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    n = i + w;
    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    n += bytes_per_pixel;
    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    n += bytes_per_pixel;
    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    n = i + w + w + bytes_per_pixel + bytes_per_pixel;

    d[n    ] += r;
    d[n + 1] += g;
    d[n + 2] += b;

    // Draw pixel
    d[i    ] = d[i + 1] = d[i + 2] = y;
  }
}




function rob_crop_image(image_data, in_w, in_h, out_w, out_h, bytes_per_pixel) {
  var result = {w:in_w, h:in_h};
  var index = 0;
  
  // crop width
  if (in_w > out_w) {
    //index = 0;
    var left_margin = Math.round((in_w - out_w) / 2) * bytes_per_pixel;  // crop horizontally centered
    for (var y = 0; y<result.h; y++) {
      var index_in = (y * in_w) * bytes_per_pixel  + left_margin;
      for (var x = 0; x<(out_w * bytes_per_pixel); x++) {
        image_data[index++] = image_data[index_in++];
      }
    }
    result.w = out_w;
  }
  
  // crop height
  if (in_h > out_h) {
    index = Math.round((in_h - out_h)/2) * result.w * bytes_per_pixel;  // crop vertically centered
    for (var i = 0; i<(out_h * result.w * bytes_per_pixel); i++) {
      image_data[i] = image_data[index++];
    }
    result.h = out_h;
  }
  
  return result;
}








// ----------------------------------------------------------------------------------------------------------------------------------
// Watchface Configuration Popup
// ------------------------------

Pebble.addEventListener('showConfiguration', function(e) {
  // Show config page
  Pebble.openURL('https://dl.dropboxusercontent.com/u/21618664/pebble/xmit/ex1.html');
});



Pebble.addEventListener("webviewclosed",
  function(e) {
    if (e && e.response) {
      if(e.response !="CANCELLED") {   //https://forums.getpebble.com/discussion/15172/pebblejs-cloudpebble-unexpected-token-c-at-object-parse-json-error
        console.log("Response Length = " + e.length);
        console.log("Response = " + e.response);
        try {
          var options = JSON.parse(e.response);
          console.log("Options = " + JSON.stringify(options));
          var configuration = JSON.parse(decodeURIComponent(e.response));
          console.log("Configuration window returned: " + JSON.stringify(configuration));
        } catch(ee) {}
//         if (e.payload.hasOwnProperty("thing"))
      } else {
        console.log("WebView Cancelled");
      }
    } else {
      console.log("No response from WebView");
    }
  }
);
