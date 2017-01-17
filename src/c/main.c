/*
Ideas:
Disable backlight flick
Disable backlight notifications (for nighttime)
 Send speech to phone when charge is at 100%
   https://www.reddit.com/r/pebble/comments/3x7yhv/notification_when_pebble_is_charged/

Input Major - Minor
Time: Seconds
Minor

Compass

GPS:
  Speed
  Position

Output Modules:
Ruler?





*/


#include <pebble.h>

static Window *window;

static BitmapLayer  *image_layer;
static GBitmap      *image = NULL;
static uint8_t      *data_image = NULL;
//static uint32_t     data_size;

static TextLayer    *text_layer;
static Layer        *graphics_layer;
static Layer        *root_layer;
static GRect         root_frame;

// #define KEY_CHUNK   0
// #define KEY_INDEX   1
// #define KEY_MESSAGE 2
// #define KEY_SIZE    3

//#define CHUNK_SIZE 1500
// #define CHUNK_SIZE 8000
#define CHUNK_SIZE 587

char text_buffer[100] = "";



char* get_gbitmapformat_text(GBitmapFormat format) {
	switch (format) {
		case GBitmapFormat1Bit:        return "GBitmapFormat1Bit";
    #ifdef PBL_COLOR
		case GBitmapFormat8Bit:        return "GBitmapFormat8Bit";
		case GBitmapFormat1BitPalette: return "GBitmapFormat1BitPalette";
		case GBitmapFormat2BitPalette: return "GBitmapFormat2BitPalette";
		case GBitmapFormat4BitPalette: return "GBitmapFormat4BitPalette";
    #endif
		default:                       return "UNKNOWN FORMAT";
	}
}

uint8_t get_number_ofcolors(GBitmapFormat format) {
  switch (format) {
    case GBitmapFormat1Bit:        return  2;
    #ifdef PBL_COLOR
    case GBitmapFormat8Bit:        return 64;
    case GBitmapFormat1BitPalette: return  2;
    case GBitmapFormat2BitPalette: return  4;
    case GBitmapFormat4BitPalette: return 16;
    #endif
    default:                       return  0;
  }
}

// ================================================================ //
//   How to support transparencies and the alpha channel
// ================================================================ //
uint8_t shadowtable[] = {192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,  /* ------------------ */ \
                         192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,  /*      0% alpha      */ \
                         192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,  /*        Clear       */ \
                         192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,192,  /* ------------------ */ \

                         192,192,192,193,192,192,192,193,192,192,192,193,196,196,196,197,  /* ------------------ */ \
                         192,192,192,193,192,192,192,193,192,192,192,193,196,196,196,197,  /*     33% alpha      */ \
                         192,192,192,193,192,192,192,193,192,192,192,193,196,196,196,197,  /*    Transparent     */ \
                         208,208,208,209,208,208,208,209,208,208,208,209,212,212,212,213,  /* ------------------ */ \

                         192,192,193,194,192,192,193,194,196,196,197,198,200,200,201,202,  /* ------------------ */ \
                         192,192,193,194,192,192,193,194,196,196,197,198,200,200,201,202,  /*     66% alpha      */ \
                         208,208,209,210,208,208,209,210,212,212,213,214,216,216,217,218,  /*    Translucent     */ \
                         224,224,225,226,224,224,225,226,228,228,229,230,232,232,233,234,  /* ------------------ */ \

                         192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,  /* ------------------ */ \
                         208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,  /*    100% alpha      */ \
                         224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,  /*      Opaque        */ \
                         240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255}; /* ------------------ */

uint8_t combine_colors(uint8_t bg_color, uint8_t fg_color) {
  return (shadowtable[((~fg_color)&0b11000000) + (bg_color&63)]&63) + shadowtable[fg_color];
}
// ================================================================ //

void draw_image(GContext *ctx, GBitmap *image, int16_t start_x, int16_t start_y) {
  GBitmap *framebuffer = graphics_capture_frame_buffer(ctx);  // Get framebuffer
  if(framebuffer) {                                           // If successfully captured the framebuffer
    uint8_t        *screen = gbitmap_get_data(framebuffer);   // Get pointer to framebuffer data
    
    uint8_t          *data = (uint8_t*)gbitmap_get_data(image);
    int16_t          width = gbitmap_get_bounds(image).size.w;
    int16_t         height = gbitmap_get_bounds(image).size.h;
    uint16_t bytes_per_row = gbitmap_get_bytes_per_row(image);
    #ifdef PBL_COLOR
    GBitmapFormat   format = gbitmap_get_format(image);
    uint8_t       *palette = (uint8_t*)gbitmap_get_palette(image);
    #endif
    
    // Bounds Checking -- feel free to remove this section if you know you won't go out of bounds
    int16_t           top = (start_y < 0) ? 0 - start_y : 0;
    int16_t          left = (start_x < 0) ? 0 - start_x : 0;
    int16_t        bottom = (height + start_y) > 168 ? 168 - start_y : height;
    int16_t         right = (width  + start_x) > 144 ? 144 - start_x : width;
    // End Bounds Checking

    uint16_t addr;
    for(int16_t y=top; y<bottom; ++y) {
      for(int16_t x=left; x<right; ++x) {
        #ifdef PBL_COLOR
        uint8_t pixel = 0;
        switch(format) {
          case GBitmapFormat1Bit:        pixel =        ((data[y*bytes_per_row + (x>>3)] >> ((7-(x&7))   )) &  1) ? GColorWhiteARGB8 : GColorBlackARGB8; break;
          case GBitmapFormat8Bit:        pixel =          data[y*bytes_per_row +  x    ];                          break;
          case GBitmapFormat1BitPalette: pixel = palette[(data[y*bytes_per_row + (x>>3)] >> ((7-(x&7))   )) &  1]; break;
          case GBitmapFormat2BitPalette: pixel = palette[(data[y*bytes_per_row + (x>>2)] >> ((3-(x&3))<<1)) &  3]; break;
          case GBitmapFormat4BitPalette: pixel = palette[(data[y*bytes_per_row + (x>>1)] >> ((1-(x&1))<<2)) & 15]; break;
          default: break;
        }
        // 1x
        //addr = (y + start_y) * 144 + x + start_x;  // memory address of the pixel on the screen currently being colored
        //screen[addr] = combine_colors(screen[addr], pixel);
        
        // 2x
        //addr = (((y+start_y)*2)+0)*144 + ((x+start_x)*2)+0; screen[addr] = combine_colors(screen[addr], pixel);
        //addr = (((y+start_y)*2)+0)*144 + ((x+start_x)*2)+1; screen[addr] = combine_colors(screen[addr], pixel);
        //addr = (((y+start_y)*2)+1)*144 + ((x+start_x)*2)+0; screen[addr] = combine_colors(screen[addr], pixel);
        //addr = (((y+start_y)*2)+1)*144 + ((x+start_x)*2)+1; screen[addr] = combine_colors(screen[addr], pixel);
        
        // 4x
        //#define zoom 1
        int zoom = (144/width < 168/height) ? 144/width : 168/height;
        for(int16_t j=0; j<zoom; ++j) {
          for(int16_t k=0; k<zoom; ++k) {
            addr = (((y+start_y)*zoom)+j)*144 + ((x+start_x)*zoom)+k;
            screen[addr] = combine_colors(screen[addr], pixel);
          }
        }
        #endif
        
        #ifdef PBL_BW
                   addr = ((y + start_y) * 20) + ((x + start_x) >> 3);             // the screen memory address of the 8bit byte where the pixel is
          uint8_t  xbit = (x + start_x) & 7;                                       // which bit is the pixel inside of 8bit byte
          screen[addr] &= ~(1<<xbit);                                              // assume pixel to be black
          screen[addr] |= ((data[(y*bytes_per_row) + (x>>3)] >> (x&7))&1) << xbit; // draw white pixel if image has a white pixel
        #endif
      }
    }
    graphics_release_frame_buffer(ctx, framebuffer);
  }
}


void graphics_layer_update(Layer *me, GContext *ctx) {
  if(image)
    draw_image(ctx, image, 0, 0);  // Draw image to screen buffer at screen location: x=0, y=0
}








// ------------------------------------------------------------------------ //
//  Jigsaw Functions and Variables
// ------------------------------------------------------------------------ //
static uint8_t *jigsaw = NULL;
static uint32_t jigsaw_size = 0;
static uint8_t jigsaw_loglevel = 1;

static void jigsaw_finished() {
  if (image) {
    gbitmap_destroy(image);
    image = NULL;
  }
  
  image = gbitmap_create_from_png_data(jigsaw, jigsaw_size);
  free(jigsaw); jigsaw = NULL;

  GRect gbsize = gbitmap_get_bounds(image);
  if (jigsaw_loglevel)
    APP_LOG(APP_LOG_LEVEL_DEBUG, "Bitmap GRect = (%d, %d, %d, %d)", gbsize.origin.x, gbsize.origin.y, gbsize.size.w, gbsize.size.h);
  text_buffer[0] = 0;  // Remove message after data is downloaded
  layer_mark_dirty(root_layer);
}


static void init_jigsaw(uint32_t total_size) {
  if (jigsaw)
    free(jigsaw);
  
  if ((jigsaw = malloc(jigsaw_size = total_size))) {
    if (jigsaw_loglevel)
      APP_LOG(APP_LOG_LEVEL_DEBUG, "New data starting: size = %d bytes", (int)jigsaw_size);
  } else {
    jigsaw_size = 0;
    if (jigsaw_loglevel)
      APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to allocate %d bytes", (int)jigsaw_size);
  }
}


static void jigsaw_add_piece(uint8_t *piece, uint32_t piece_index, uint16_t piece_length) {
  APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Piece: index=%d/%d piece size=%d", (int)piece_index, (int)jigsaw_size, (int)piece_length);
  if (jigsaw) {
    memcpy(jigsaw + piece_index, piece, piece_length);

    // Display percentage downloaded (Add length cause it's already done downloading that part)
    snprintf(text_buffer, sizeof(text_buffer), "%d/%d bytes (%d%%)", (int)(piece_index+piece_length), (int)jigsaw_size, (int)((piece_index+piece_length)*100/jigsaw_size));
    layer_mark_dirty(root_layer);

    if(piece_index + piece_length >= jigsaw_size)
      jigsaw_finished();
  } else {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Can't add piece: Jigsaw not allocated! Discarding piece.");
  }
}


static void jigsaw_check_iterator(DictionaryIterator *iter) {
  Tuple *jigsaw_init_tuple, *jigsaw_piece_tuple, *jigsaw_index_tuple;

  // If phone is starting to send new blob of data
  if ((jigsaw_init_tuple = dict_find(iter, MESSAGE_KEY_JIGSAW_INIT))) {
    init_jigsaw(jigsaw_init_tuple->value->uint32);
  }

  // If phone is sending a jigsaw piece
  if ((jigsaw_piece_tuple = dict_find(iter, MESSAGE_KEY_JIGSAW_PIECE))) {
    if ((jigsaw_index_tuple = dict_find(iter, MESSAGE_KEY_JIGSAW_PIECE_INDEX))) {
      uint32_t piece_index = jigsaw_index_tuple->value->uint32;
      uint16_t piece_length = jigsaw_piece_tuple->length;
      uint8_t *piece = &jigsaw_piece_tuple->value->uint8;
      jigsaw_add_piece(piece, piece_index, piece_length);
    }
  }
}





// ------------------------------------------------------------------------ //
//  AppMessage Functions
// ------------------------------------------------------------------------ //
static void appmessage_in_received_handler(DictionaryIterator *iter, void *context) {
  // If there's a message
  Tuple *message_tuple = dict_find(iter, MESSAGE_KEY_MESSAGE);
  if(message_tuple){
    snprintf(text_buffer, sizeof(text_buffer), "%s", message_tuple->value->cstring);
    text_layer_set_text(text_layer, text_buffer);
  }

  // Check if there is a jigsaw piece
  jigsaw_check_iterator(iter);
  
//   // Get the bitmap
//   Tuple *size_tuple  = dict_find(iter, MESSAGE_KEY_SIZE);
//   if(size_tuple){
//     if(data_image)
//       free(data_image);
//     data_size = size_tuple->value->uint32;
//     data_image = malloc(data_size);
//     APP_LOG(APP_LOG_LEVEL_DEBUG, "new image starting: size = %d bytes", (int)data_size);
//   }

//   Tuple *chunk_tuple = dict_find(iter, MESSAGE_KEY_CHUNK);
//   Tuple *index_tuple = dict_find(iter, MESSAGE_KEY_INDEX);
  
//   if (index_tuple && chunk_tuple) {
//     uint32_t index = index_tuple->value->uint32;

//     APP_LOG(APP_LOG_LEVEL_DEBUG, "chunk received: index=%d/%d chunk size=%d", (int)index, (int)data_size, (int)chunk_tuple->length);
//     memcpy(data_image + index, &chunk_tuple->value->uint8, chunk_tuple->length);

//     // Add chunk_tuple->length cause it's done downloading that part
//     snprintf(text_buffer, sizeof(text_buffer), "%d/%d bytes (%d%%)", (int)(index+chunk_tuple->length), (int)data_size, (int)((index+chunk_tuple->length)*100/data_size));
//     text_layer_set_text(text_layer, text_buffer);
    
//     if(chunk_tuple->length < CHUNK_SIZE || index+CHUNK_SIZE==data_size) {
//       if(image){
//         gbitmap_destroy(image);
//         image = NULL;
//       }
//       image = gbitmap_create_from_png_data(data_image, data_size);
//       //bitmap_layer_set_bitmap(image_layer, image);

//       GRect gbsize = gbitmap_get_bounds(image);
//       APP_LOG(APP_LOG_LEVEL_DEBUG, "Bitmap GRect = (%d, %d, %d, %d)", gbsize.origin.x, gbsize.origin.y, gbsize.size.w, gbsize.size.h);
//       text_layer_set_text(text_layer, "");
//     }
//   }
  
  layer_mark_dirty(root_layer);
}

static void app_message_init() {
  // Register message handlers
  app_message_register_inbox_received(appmessage_in_received_handler);
  // Init buffers
  // Size = 1 + 7 * N + size0 + size1 + .... + sizeN
  //app_message_open(app_message_inbox_size_maximum(), APP_MESSAGE_OUTBOX_SIZE_MINIMUM);
  app_message_open(1 + 7*2 + sizeof(int32_t) + CHUNK_SIZE, APP_MESSAGE_OUTBOX_SIZE_MINIMUM);
}

static void select_click_handler(ClickRecognizerRef recognizer, void *context) {
  if(image){
    gbitmap_destroy(image);
    image = NULL;
    bitmap_layer_set_bitmap(image_layer, image);
  }

  text_layer_set_text(text_layer, "Requesting image...");

  DictionaryIterator *iter;
  uint8_t value = 1;
  app_message_outbox_begin(&iter);
  dict_write_int(iter, MESSAGE_KEY_COMMAND, &value, 1, true);
  dict_write_end(iter);
  app_message_outbox_send();
}

static void click_config_provider(void *context) {
  window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
}

static void window_load(Window *window) {
  root_layer = window_get_root_layer(window);
  root_frame = layer_get_frame(root_layer);

  image_layer = bitmap_layer_create(root_frame);
  bitmap_layer_set_alignment(image_layer, GAlignCenter);
  layer_add_child(root_layer, bitmap_layer_get_layer(image_layer));

  text_layer = text_layer_create(GRect(0, root_frame.size.h - 64, root_frame.size.w, 32));
  text_layer_set_text(text_layer, "Wait for JavaScript...");
  text_layer_set_font(text_layer, fonts_get_system_font(FONT_KEY_GOTHIC_14));
  text_layer_set_overflow_mode(text_layer, GTextOverflowModeWordWrap);
  text_layer_set_text_alignment(text_layer, GTextAlignmentCenter);
  text_layer_set_background_color(text_layer, GColorClear);
  layer_add_child(root_layer, text_layer_get_layer(text_layer));
  
  graphics_layer = layer_create(root_frame);
  layer_set_update_proc(graphics_layer, graphics_layer_update);
  layer_add_child(root_layer, graphics_layer);
}

static void window_unload(Window *window) {
  text_layer_destroy(text_layer);
  bitmap_layer_destroy(image_layer);
  if(image){
    gbitmap_destroy(image);
  }
  if(data_image){
    free(data_image);
  }
}

static void init(void) {
  app_message_init();
  window = window_create();
  window_set_click_config_provider(window, click_config_provider);
  window_set_window_handlers(window, (WindowHandlers) {
    .load = window_load,
    .unload = window_unload,
  });
  window_stack_push(window, true);
}

static void deinit(void) {
  window_destroy(window);
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}
