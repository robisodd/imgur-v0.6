// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Includes
// ------------------------------
var Zlib = require('zlib');

// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Globals
// ------------------------------
var warnings = true;
var debug = true;

// ------------------------------------------------------------------------------------------------------------------------------------------------ //
//  Constants
// ------------------------------
var COLORTYPE_GREYSCALE   = 0;  // bitdepth: 1, 2, 4, 8, 16  Each pixel is a greyscale sample
var COLORTYPE_COLOR       = 2;  // bitdepth:          8, 16  Each pixel is an R,G,B triple
var COLORTYPE_INDEXED     = 3;  // bitdepth: 1, 2, 4, 8      Each pixel is a palette index; a PLTE chunk shall appear.
var COLORTYPE_GREY_ALPHA  = 4;  // bitdepth:          8, 16  Each pixel is a greyscale sample followed by an alpha sample.
var COLORTYPE_COLOR_ALPHA = 6;  // bitdepth:          8, 16  Each pixel is an R,G,B triple followed by an alpha sample.

var FILTER_NONE    = 0;
var FILTER_SUB     = 1;
var FILTER_UP      = 2;
var FILTER_AVERAGE = 3;
var FILTER_PAETH   = 4;




function inflate_pixels(png) {
  var byte, pixel_pos, col, data, i, left, p, pa, paeth, pb, pc, pixelBytes, pixels, data_pos, row, scanlineLength, upper, upperLeft;
  if (png.imgData.length === 0)
    return new Uint8Array(0);
  data = new Zlib.Inflate(png.imgData).decompress();
  pixelBytes = png.pixelBitlength / 8;
  scanlineLength = pixelBytes * png.width;
  pixels = new Uint8Array(scanlineLength * png.height);
  row = 0;
  data_pos = 0;
  pixel_pos = 0;
  while (data_pos < data.length) {
    switch (data[data_pos++]) {  // Which filter algorithm this specific row is encoded with
      case FILTER_NONE:
        for (i = 0; i < scanlineLength; i += 1) {
          pixels[pixel_pos++] = data[data_pos++];
        }
        break;
        
      case FILTER_SUB:
        for (i = 0; i < scanlineLength; i += 1) {
          byte = data[data_pos++];
          left = i < pixelBytes ? 0 : pixels[pixel_pos - pixelBytes];
          pixels[pixel_pos++] = (byte + left) % 256;
        }
        break;
        
      case FILTER_UP:
        for (i = 0; i < scanlineLength; i += 1) {
          byte = data[data_pos++];
          col = (i - (i % pixelBytes)) / pixelBytes;
          upper = row && pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
          pixels[pixel_pos++] = (upper + byte) % 256;
        }
        break;
        
      case FILTER_AVERAGE:
        for (i = 0; i < scanlineLength; i += 1) {
          byte = data[data_pos++];
          col = (i - (i % pixelBytes)) / pixelBytes;
          left = i < pixelBytes ? 0 : pixels[pixel_pos - pixelBytes];
          upper = row && pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
          pixels[pixel_pos++] = (byte + Math.floor((left + upper) / 2)) % 256;
        }
        break;
        
      case FILTER_PAETH:
        for (i = 0; i < scanlineLength; i += 1) {
          byte = data[data_pos++];
          col = (i - (i % pixelBytes)) / pixelBytes;
          left = i < pixelBytes ? 0 : pixels[pixel_pos - pixelBytes];
          if (row === 0) {
            upper = upperLeft = 0;
          } else {
            upper = pixels[(row - 1) * scanlineLength + col * pixelBytes + (i % pixelBytes)];
            upperLeft = col && pixels[(row - 1) * scanlineLength + (col - 1) * pixelBytes + (i % pixelBytes)];
          }
          p = left + upper - upperLeft;
          pa = Math.abs(p - left);
          pb = Math.abs(p - upper);
          pc = Math.abs(p - upperLeft);
          if (pa <= pb && pa <= pc) {
            paeth = left;
          } else if (pb <= pc) {
            paeth = upper;
          } else {
            paeth = upperLeft;
          }
          pixels[pixel_pos++] = (byte + paeth) % 256;
        }
        break;
        
      default:
        throw new Error("Invalid filter algorithm: " + data[data_pos - 1]);
    }
    row++;
  }
  return pixels;
}



function add_transparency_to_palette(rgbpalette, transparency_palette) {
  var transparency = transparency_palette.indexed || [];
  var rgbaPalette = new Uint8Array(rgbpalette.length * 4 / 3);
  for (var pal_pos = 0, rgba_pos = 0, trans_pos = 0, ref;
       pal_pos < rgbpalette.length;
       pal_pos += 3
      ) {
    rgbaPalette[rgba_pos++] = rgbpalette[pal_pos];
    rgbaPalette[rgba_pos++] = rgbpalette[pal_pos + 1];
    rgbaPalette[rgba_pos++] = rgbpalette[pal_pos + 2];
    rgbaPalette[rgba_pos++] = (ref = transparency[trans_pos++]) != null ? ref : 255;
  }
  return rgbaPalette;
}



// Decode() takes in png.pixels and returns an RGBA array [png.height * png.width].
// means different things for different color tyeps:
// COLORTYPE_GREYSCALE   = Copy each gray pixel 3 times into RGB, then 255 into A (unless gray pixel = transparent shade)
// COLORTYPE_COLOR       = Copy each RGB into RGB and copy 255 into A (unless RGB = transparent color)
// COLORTYPE_INDEXED     = For each RGBA: Lookup palette index and copy palette's RGB into RGB (and A if its there)
// COLORTYPE_GREY_ALPHA  = For each rgba: Copy each gray pixel 3 times into RGB and then alpha into A
// COLORTYPE_COLOR_ALPHA = Do Nothing, return RGBA pixels
function decode(png) {
  var i, k, y, r, g, b;
  var data = new Uint8Array(png.width * png.height * 4);  // * 4 since each pixel is RGBA
  var colors = png.colors;
  var rgbapalette = null;
  var alpha = png.hasAlphaChannel;
  if (png.rgbpalette.length) {
    rgbapalette = add_transparency_to_palette(png.rgbpalette, png.transparency);  // png.palette = rgb, palette = rgba
    colors = 4;
    alpha = true;
  }
  var input = rgbapalette || png.pixels;
  i = k = 0;
  while (i < data.length) {
    k = rgbapalette ? png.pixels[i / 4] * 4 : k;
    if (colors === 1) {                                // If grayscale
      y = data[i++] = input[k++];
          data[i++] = y;
          data[i++] = y;
          data[i++] = (
            png.transparency.grayscale ?                   // If there exists a transparent replacement shade
            (png.transparency.grayscale == y ? 0 : 255 ) : // then: if the current shade is it, alpha = clear, else opaque
            (alpha ? input[k++] : 255)                     // else: if alpha channel exists, copy it to alpha, else opaque
          );
    } else {                                           // else: not grayscale (is color)
      r = data[i++] = input[k++];
      g = data[i++] = input[k++];
      b = data[i++] = input[k++];
      data[i++] = (
        png.transparency.rgb ?                             // If there exists a transparent replacement color
        ((r==png.transparency.rgb[1] && g==png.transparency.rgb[2] && b==png.transparency.rgb[3]) ? 0 : 255) :
        (alpha ? input[k++] : 255)                         // else: if alpha channel exists, copy it to alpha, else opaque
      );
    }
  }

  return data;
}

// function decode(png) {
//   var i, j, k, y, r, g, b;
//   var data = new Uint8Array(png.width * png.height * 4);  // * 4 since each pixel is RGBA
//   var colors = png.colors;
//   var palette = null;
//   var alpha = png.hasAlphaChannel;
//   if (png.palette.length) {
//     palette = add_transparency_to_palette(png.palette, png.transparency);
//     colors = 4;
//     alpha = true;
//   }
//   var input = palette || png.pixels;
//   i = j = 0;
//   if (colors === 1) {
//     while (i < data.length) {
//       k = palette ? png.pixels[i / 4] * 4 : j;
//       y = data[i++] = input[k++];
//       data[i++] = y;
//       data[i++] = y;
//       data[i++] = (
//         png.transparency.grayscale ?
//         (png.transparency.grayscale == y ? 0 : 255 ) :
//         (alpha ? input[k++] : 255)
//       );
//       j = k;
//     }
//   } else {
//     while (i < data.length) {
//       k = palette ? png.pixels[i / 4] * 4 : j;
//       r = data[i++] = input[k++];
//       g = data[i++] = input[k++];
//       b = data[i++] = input[k++];
//       data[i++] = (
//         png.transparency.rgb ?
//         ((r==png.transparency.rgb[1] && g==png.transparency.rgb[2] && b==png.transparency.rgb[3]) ? 0 : 255) :
//         (alpha ? input[k++] : 255)
//       );
//       j = k;
//     }
//   }
  
//   return data;
// }



function readHeader(png) {
  var header = [];
  for (var i = 0; i < 4; ++i)
    header.push(String.fromCharCode(png.data[png.pos++]));
  return header.join('');
}



function readBytes(png, bytes) {
  var results = [];
  for (var i = 0; i < bytes; ++i)
    results.push(png.data[png.pos++]);
  return results;
}



function readUInt32(png) {
  return (
    (png.data[png.pos++] << 24) |
    (png.data[png.pos++] << 16) |
    (png.data[png.pos++] <<  8) |
    (png.data[png.pos++]      )
  );
}



function verifySignature(png) {
  var SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
  for (var i = 0; i < 8; ++i) {
    if (SIGNATURE[i] != png.data[i])
      return false;
  }
  if (debug) console.log("PNG signature is valid");
  return true;
}



function convert_PNG_to_image(data) {
  var png = {};
  
  png.pos = 8;
  png.data = data;  // File Data
  png.rgbpalette = []; // rgb palette (if exists)
  png.imgData = []; // Extracted IDAT chunk
  png.pixels = [];  // [height * width] array of image (may be Gray, RGB, RGBA, or Palette Indexes)
  png.transparency = {}; // Transparency Color or Palette (if exists)
  
  if (!verifySignature(png))
    throw new Error("Not a PNG file (Invalid signature)");
  
  var chunkSize, chunkType, i;

  while (true) {

    // Read Chunk Size and Header
    chunkSize = readUInt32(png);
    chunkType = readHeader(png);

    switch (chunkType) {
      case 'IHDR':
        png.width             = readUInt32(png);
        png.height            = readUInt32(png);
        png.bits              = png.data[png.pos++];
        png.colorType         = png.data[png.pos++];
        png.compressionMethod = png.data[png.pos++];
        png.filterMethod      = png.data[png.pos++];
        png.interlaceMethod   = png.data[png.pos++];
        //console.log("IHDR found: Color Type=" + png.colorType + " Size=(" + png.width + "w x " + png.height + "h)");
        break;
        
      case 'PLTE':
        png.rgbpalette = readBytes(png, chunkSize);
        break;
        
      case 'fdAT':
        png.pos += 4;
        chunkSize -= 4;
        // fall through to IDAT
      case 'IDAT':
        data = png.imgData;
        for (i = 0; i < chunkSize; ++i) {
          data.push(png.data[png.pos++]);
        }
        break;

      case 'tRNS':
        if (debug) console.log("Transparency Found!  ColorType=" + png.colorType);
        png.transparency = {};
        switch (png.colorType) {
          case COLORTYPE_GREYSCALE:  // Shade to replace with 100% transparency
            png.transparency.grayscale = readBytes(png, chunkSize)[0];
            break;
            
          case COLORTYPE_COLOR:      // Color to replace with 100% transparency
            png.transparency.rgb = readBytes(png, chunkSize);
            break;
            
          case COLORTYPE_INDEXED:    // Alpha palette (to combine with palette)
            png.transparency.indexed = readBytes(png, chunkSize);
            var short = 256 - png.transparency.indexed.length;
            for (i = 0; i < short; ++i)
              png.transparency.indexed.push(255);
            break;
            
          default:
            png.pos += chunkSize; // tRNS for some other colortype.  discard.
            if (warnings) console.log("Discarding transparency chunk found for color type " + png.colorType);
        }
        break;
        


      case 'IEND':
        var colors          = [1, 0, 3, 1, 1, 0, 3];
        png.colors          = colors[png.colorType];
        png.hasAlphaChannel = png.colorType === COLORTYPE_GREY_ALPHA || png.colorType === COLORTYPE_COLOR_ALPHA;
        colors              = png.colors + (png.hasAlphaChannel ? 1 : 0);
        png.pixelBitlength  = png.bits * colors;
        png.imgData         = new Uint8Array(png.imgData);
        png.pixels          = inflate_pixels(png);  // Returns grayscale, rgb, rgba or "paint by numbers"
        png.rgba            = decode(png);
        return {"width":png.width, "height":png.height, "data":png.rgba};
        
      default:  // Unknown chunk type. Skip it!
        png.pos += chunkSize;
    } // switch
    
    png.pos += 4;  // pass up crc
    
    if (png.pos >= png.data.length) {
      throw new Error("Incomplete or corrupt PNG file (EOF reached without IEND chunk)");
      //return {"width" : 0, "height" : 0, "data" : new Uint8Array(0)};
    }
  } // while (true)
}




module.exports = convert_PNG_to_image;






// PNG.prototype.decode_rgb = function() {
//   if(this.palette.length === 0) 
//     return this.pixels;
  
//   var pixels_rgb = [];
//   for(var i=0; i<this.pixels.length; i++) {
//     pixels_rgb.push(this.palette[3*this.pixels[i]+0] & 0xFF);
//     pixels_rgb.push(this.palette[3*this.pixels[i]+1] & 0xFF);
//     pixels_rgb.push(this.palette[3*this.pixels[i]+2] & 0xFF);
//   }
//   return pixels_rgb;
// };

// PNG.prototype.decode_rgba = function() {
//   if(this.decodedPalette.length === 0) 
//     return this.pixels;
  
//   var pixels_rgba = [];
//   for(var i=0; i<this.pixels.length; i++) {
//     pixels_rgba.push(this.decodedPalette[4*this.pixels[i]+0] & 0xFF);
//     pixels_rgba.push(this.decodedPalette[4*this.pixels[i]+1] & 0xFF);
//     pixels_rgba.push(this.decodedPalette[4*this.pixels[i]+2] & 0xFF);
//     pixels_rgba.push(255);
//   }
//   return pixels_rgba;
// };
// Generated by CoffeeScript 1.4.0





/*
# MIT LICENSE
# Copyright (c) 2011 Devon Govett
# 
# Permission is hereby granted, free of charge, to any person obtaining a copy of this 
# software and associated documentation files (the "Software"), to deal in the Software 
# without restriction, including without limitation the rights to use, copy, modify, merge, 
# publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons 
# to whom the Software is furnished to do so, subject to the following conditions:
# 
# The above copyright notice and this permission notice shall be included in all copies or 
# substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
# BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
# DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
