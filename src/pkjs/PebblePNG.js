'use strict';  // jshint ignore:line
//var Zlib = require('./deflate.js');
var Zlib = require('zlib');

// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Constants
// ------------------------------
var COLORTYPE_GREYSCALE   = 0;  // bitdepth: 1, 2, 4, 8, 16  Each pixel is a greyscale sample
var COLORTYPE_COLOR       = 2;  // bitdepth:          8, 16  Each pixel is an R,G,B triple
var COLORTYPE_INDEXED     = 3;  // bitdepth: 1, 2, 4, 8      Each pixel is a palette index; a PLTE chunk shall appear.
var COLORTYPE_GREY_ALPHA  = 4;  // bitdepth:          8, 16  Each pixel is a greyscale sample followed by an alpha sample.
var COLORTYPE_COLOR_ALPHA = 6;  // bitdepth:          8, 16  Each pixel is an R,G,B triple followed by an alpha sample.

var COMPRESSION_DEFLATE   = 0;

var FILTERING_ADAPTIVE    = 0;

var INTERLACE_NONE        = 0;
var INTERLACE_ADAM7       = 1;

/*
https://developer.pebble.com/docs/c/Foundation/Resources/File_Formats/PNG8_File_Format/
PNG8 is a PNG that uses palette-based or grayscale images with 1, 2, 4 or 8 bits per pixel.
For palette-based images the pixel data represents the index into the palette,
such that each pixel only needs to be large enough to represent the palette size, so.

1-bit supports up to 2 colors,
2-bit supports up to 4 colors,
4-bit supports up to 16 colors,
8-bit supports up to 256 colors.

There are 2 parts to the palette: the RGB24 color-mapping palette ("PLTE"),
and the optional 8-bit transparency palette ("tRNs").
A pixel's color index maps to both tables, combining to allow the pixel to have both color as well as transparency.
For grayscale images, the pixel data represents the luminosity (or shade of gray).

1-bit supports black and white
2-bit supports black, dark_gray, light_gray and white
4-bit supports black, white and 14 shades of gray
8-bit supports black, white and 254 shades of gray

Optionally, grayscale images allow for 1 fully transparent color, which is removed from the fully-opaque colors above 
(e.g. a 2 bit grayscale image can have black, white, dark_gray and a transparent color).
*/
// ------------------------------------------------------------------------------------------------------------------------------------------------ //
// Generate CRC Table and Calculate CRC
// Adapted from: https://www.w3.org/TR/PNG/#D-CRCAppendix
// ------------------------------
var crc_table = [];
for (var n = 0; n < 256; n++) {
  var c = n;
  for (var k = 0; k < 8; k++)
    if (c & 1)
      c = 0xedb88320 ^ (c >>> 1);
    else
      c = c >>> 1;
  crc_table[n] = c;
}

function crc(buf) {
  var c = 0xffffffff;
  for (var n = 0; n < buf.length; n++)
    c = crc_table[(c ^ buf[n]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}


function dword(dword) {
  return [(dword >>> 24) & 0xFF,
          (dword >>> 16) & 0xFF,
          (dword >>>  8) & 0xFF,
          (dword       ) & 0xFF];
}


function create_chunk(type, data) {
  return Array.prototype.concat(dword(data.length), type, data, dword(crc(type.concat(data))));
}


function create_header(width, height, bit_depth, color_type) {
  return Array.prototype.concat(
    dword(width),
    dword(height),
    [bit_depth,
     color_type,
     COMPRESSION_DEFLATE,
     FILTERING_ADAPTIVE,
     INTERLACE_NONE
    ]
  );
}



// Spec from: https://www.w3.org/TR/PNG/
// data should be an array of bytes
// function generate(data) {
//   w = data.length; h = 1;
//   var compressed_array = new zip.deflate(parse_data(data)).compress();
//   var compressed_data = Array.prototype.slice.call(compressed_array);  // Convert TypedArray to standard JS array
//   //console.log("Size before / after compression: " + data.length + " / " + compressed_data.length);
  
//   var SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];           // PNG Signature
//   var IHDR_data = create_header(w*8, h, 1);        // PNG Header
//   var IHDR = create_chunk([73, 72, 68, 82], IHDR_data);        // PNG Header
//   var IDAT = create_chunk([73, 68, 65, 84], compressed_data);  // PNG Compressed Data
//   var IEND = create_chunk([73, 69, 78, 68], []);               // PNG End
//   return Array.prototype.concat(SIGNATURE, IHDR, IDAT, IEND);  // Return PNG in a byte array
// }





var PEBBLE_PALETTE = [];

function make_pebble_palette_color() {
  PEBBLE_PALETTE = [];
  for(var i=0; i<64; i++){
    PEBBLE_PALETTE.push(((i >> 4) & 0x3) * 85);
    PEBBLE_PALETTE.push(((i >> 2) & 0x3) * 85);
    PEBBLE_PALETTE.push(((i >> 0) & 0x3) * 85);
  }
}


function make_pebble_palette_bw() {
  PEBBLE_PALETTE = [];
  PEBBLE_PALETTE.push(0);
  PEBBLE_PALETTE.push(0);
  PEBBLE_PALETTE.push(0);

  PEBBLE_PALETTE.push(255);
  PEBBLE_PALETTE.push(255);
  PEBBLE_PALETTE.push(255);
}

// var PEBBLE_PALETTE = [];
function make_pebble_png_palette(make_color_palette) {
  PEBBLE_PALETTE = [];
  if(make_color_palette) {
    for (var i = 0; i < 64; i++) {
      PEBBLE_PALETTE.push(((i >> 4) & 0x3) * 85);
      PEBBLE_PALETTE.push(((i >> 2) & 0x3) * 85);
      PEBBLE_PALETTE.push(((i >> 0) & 0x3) * 85);
    }
  } else {  // else, make Black and White palette
  PEBBLE_PALETTE.push(0);
  PEBBLE_PALETTE.push(0);
  PEBBLE_PALETTE.push(0);

  PEBBLE_PALETTE.push(255);
  PEBBLE_PALETTE.push(255);
  PEBBLE_PALETTE.push(255);
  }
}





  function map_color_to_palette(palette, red, green, blue) {
    var diffR, diffG, diffB, diffDistance, mappedColor;
    var distance = 3 * 0xFF * 0xFF;  // Max distance
    for(var i=0; i<palette.length; i+=3) {
      diffR = ( palette[i  ] - red );
      diffG = ( palette[i+1] - green );
      diffB = ( palette[i+2] - blue );
      diffDistance = diffR*diffR + diffG*diffG + diffB*diffB;
      if( diffDistance < distance ) { 
        distance = diffDistance; 
        mappedColor = i/3; 
      }
    }
    return(mappedColor);
  }
 
  var png_palette = {},
      png_palette_buff = [],
      paletteIndex = 0;
  
  function getColorIndex(red, green, blue) {
    var color = (((red << 8) | green) << 8) | blue;
    if (typeof png_palette[color] == "undefined") {
      var mappedColorId = map_color_to_palette(PEBBLE_PALETTE, red, green, blue);

      red     = PEBBLE_PALETTE[3*mappedColorId + 0];
      green   = PEBBLE_PALETTE[3*mappedColorId + 1];
      blue    = PEBBLE_PALETTE[3*mappedColorId + 2];

      var color_to_pebble = (((red << 8) | green) << 8) | blue;
      if (typeof png_palette[color_to_pebble] == "undefined") {
        png_palette_buff.push(red);
        png_palette_buff.push(green);
        png_palette_buff.push(blue);
        png_palette[color_to_pebble] = paletteIndex++;
      }
      png_palette[color] = png_palette[color_to_pebble];

    }
    return png_palette[color];
  }


var IMAGE_TYPE_COLOR_1BIT = 0x11;
var IMAGE_TYPE_COLOR_2BIT = 0x12;
var IMAGE_TYPE_COLOR_4BIT = 0x14;
var IMAGE_TYPE_COLOR_6BIT = 0x16;
var IMAGE_TYPE_COLOR_8BIT = 0x18;
var IMAGE_TYPE_BW_1BIT = 0x01;
var IMAGE_TYPE_BW_2BIT = 0x02;  // alpha (palette = [transparent, black, white])

// How to convert:
// See if length / (width*height) = 3 or 4 (alpha channel)
// Force all colors and alpha to 2 bits
// See if alpha is not 3 (100%) anywhere
//   If not, remove alpha, set to 3 bitdepth
// Count number of colors
// If Colors = 2
//   if colors = black and white


function generate(width, height, rgba, type) {
  var bitwidth = 4;
  var colortype = COLORTYPE_INDEXED;
//COLORTYPE_GREYSCALE

  var y, x, i;
     

  // compute the reduced palette
  for (i = 0; i < height*width; i++)
    getColorIndex(rgba[bitwidth * i + 0] & 0xff, rgba[bitwidth * i + 1] & 0xff, rgba[bitwidth * i + 2] & 0xff);
  
  var unique_colors = png_palette_buff.length / 3;
  var bitdepth;
  
       if(unique_colors > 16) { bitdepth = 8; console.log("bit depth = 8 (" + unique_colors + " / 64 colors)");} 
  else if(unique_colors >  4) { bitdepth = 4; console.log("bit depth = 4 (" + unique_colors + " / 16 colors)");} 
  else if(unique_colors >  2) { bitdepth = 2; console.log("bit depth = 2 (" + unique_colors + " / 4 colors)");} 
  else                        { bitdepth = 1; console.log("bit depth = 1 (" + unique_colors + " / 2 colors)");}

  var scanlinesArray = [];
  
  for (y = 0; y < height; y++) {
    scanlinesArray.push(0);  // 0 = No Filter
    var bit_offset = 0;
    var curr_byte  = 0;
    for (x = 0; x < width; x++) {
      bit_offset += bitdepth;
      curr_byte  += getColorIndex(rgba[bitwidth * (y * width + x)    ] & 0xff,
                                  rgba[bitwidth * (y * width + x) + 1] & 0xff,
                                  rgba[bitwidth * (y * width + x) + 2] & 0xff) << (8 - bit_offset);
      
      if(bit_offset == 8) {
        scanlinesArray.push(curr_byte);
        curr_byte   = 0;
        bit_offset  = 0;
      }
    }
    if(bit_offset > 0)
      scanlinesArray.push(curr_byte);
  }

  var compressedArray = new Zlib.Deflate(scanlinesArray).compress();  // jshint ignore:line
  var data = Array.prototype.slice.call(compressedArray);  // Convert TypedArray to standard JS array
  
  var SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  var IHDR_data = create_header(width, height, bitdepth, colortype); // PNG Header Data
  var IHDR = create_chunk([73, 72, 68, 82], IHDR_data);              // PNG Header
  var PLTE = create_chunk([80, 76, 84, 69], png_palette_buff);       // PNG Palette
  var IDAT = create_chunk([73, 68, 65, 84], data);                   // PNG Compressed Data
  var IEND = create_chunk([73, 69, 78, 68], []);                     // PNG End
  return Array.prototype.concat(SIGNATURE, IHDR, PLTE, IDAT, IEND);  // Return PNG in a byte array  
}




exports.generate = generate;
exports.make_pebble_palette_color = make_pebble_palette_color;
exports.make_pebble_palette_bw = make_pebble_palette_bw;
exports.make_pebble_png_palette = make_pebble_png_palette;