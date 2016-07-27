#include <pebble.h>
#include <math.h>

static Window *s_window;
int angle;
static GFont s_res_gothic_28;
static GFont s_res_gothic_24;
static GFont s_res_gothic_18;
static GFont s_res_gothic_14;
static GFont s_res_bitham_42_light;
static GFont gothicbold;
static GFont s_font;
static TextLayer *backgroundText;
static TextLayer *nameText;
static TextLayer *distanceText;
static TextLayer *catchChanceText;
static TextLayer *directionText;
static TextLayer *despawnTimeLayer;
bool hasRecievedResponse;
bool isGoodResponse;
bool compassIsCalibrated;
bool firstTimeBeingCalibrated;
static Layer *s_canvas_layer;
static GBitmap *s_bitmap;
int arrowAngle;


void stopped(Animation *anim, bool finished, void *context){
	property_animation_destroy((PropertyAnimation*) anim);
}

void animate_layer(Layer *layer, GRect *start, GRect *finish, int duration, int delay){
	PropertyAnimation *anim = property_animation_create_layer_frame(layer, start, finish);

	animation_set_duration((Animation*) anim, duration);
	animation_set_delay((Animation*) anim, delay);

	AnimationHandlers handlers = {
		.stopped = (AnimationStoppedHandler) stopped
	};
	animation_set_handlers((Animation*) anim, handlers, NULL);

	animation_schedule((Animation*) anim);
}

// Keys for AppMessage Dictionary
// These should correspond to the values you defined in appinfo.json/Settings
enum {
	STATUS_KEY = 0,
	MESSAGE_KEY = 1,
	TYPEONE_KEY = 2,
	TYPETWO_KEY = 3,
	CAPRATE_KEY = 4,
	FLEERATE_KEY = 5,
	NAME_KEY = 6,
	STAMINA_KEY = 7,
	DEFENSE_KEY = 8,
	ATTACK_KEY = 9,
	ANGLE_KEY = 10
};

//The dictation session pointer we'll be using
DictationSession *dictation_session;
//The string/character pointer that we will be essentially copying our transcription to
static char last_text[512];

//Gets a human readable dictation status of each of the dictation statuses
char *get_readable_dictation_status(DictationSessionStatus status){
	switch(status){
		case DictationSessionStatusSuccess:
		return "Success";
		case DictationSessionStatusFailureTranscriptionRejected:
		return "User rejected success";
		case DictationSessionStatusFailureTranscriptionRejectedWithError:
		return "User rejected error";
		case DictationSessionStatusFailureSystemAborted:
		return "Too many errors, UI gave up";
		case DictationSessionStatusFailureNoSpeechDetected:
		return "No speech, UI exited";
		case DictationSessionStatusFailureConnectivityError:
		return "No BT/internet connection";
		case DictationSessionStatusFailureDisabled:
		return "Voice dictation disabled";
		case DictationSessionStatusFailureInternalError:
		return "Internal error";
		case DictationSessionStatusFailureRecognizerError:
		return "Failed to transcribe speech";
	}
	return "Unknown";
}

// Write message to buffer & send
static void send_message(){
	DictionaryIterator *iter;

	app_message_outbox_begin(&iter);
	dict_write_cstring(iter, MESSAGE_KEY, "nothing");
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Message sending %s", "nothing");

	dict_write_end(iter);
	app_message_outbox_send();
}

//This is called when the dictation API has something for us (good or bad)
void dictation_session_callback(DictationSession *session, DictationSessionStatus status, char *transcription, void *context) {
	//It checks if it's all good and in the clear
	if(status == DictationSessionStatusSuccess) {
		//send transcription
		snprintf(last_text, sizeof(last_text), "%s", transcription);
		//send_message(last_text);

	}
	//Otherwise if it is crap
	else{
		static char failed_buff[128];
		//Prints why to the failed buffer
		snprintf(failed_buff, sizeof(failed_buff), "Transcription failed because:\n%s", get_readable_dictation_status(status));

	}
}



//This is called when the select button is pressed
void select_click_handler(ClickRecognizerRef recognizer, void *context) {
	send_message();
	//dictation_session = dictation_session_create(sizeof(last_text), dictation_session_callback, NULL);
	//dictation_session_start(dictation_session);
}

void click_config_provider(void *context) {
	window_single_click_subscribe(BUTTON_ID_SELECT, select_click_handler);
}

//please ignore my random characters in the buffer, it was only to make them longer and im not proud of it
void process_tuple(Tuple *t){
	//APP_LOG(APP_LOG_LEVEL_INFO, "Processing tuple");
	//APP_LOG(APP_LOG_LEVEL_INFO, "Compass Calibration: %d" , compassIsCalibrated);

	int key = t->key;
	if (key == 0) {

		// GRect from_frame =  GRect(22, -100, 100, 100);
		// GRect to_frame = GRect(22, 34, 100, 100);
		// animate_layer(bitmap_layer_get_layer(pokemonBitmapLayer), &from_frame, &to, 1000, 0);

		if(compassIsCalibrated) {
			int value = t->value->int32;

			if (value == 0) { // pokevision is down
				text_layer_set_text(directionText, "Error!");
				text_layer_set_text(nameText, "");
				text_layer_set_text(despawnTimeLayer, "Pokevision.com is down");
				text_layer_set_text(distanceText, "Can't contact servers");
				text_layer_set_text(catchChanceText, "Try again later");
				hasRecievedResponse = true;
				isGoodResponse = false;
			} else if (value == 1) { // request timed out
				text_layer_set_text(directionText, "Error!");
				text_layer_set_text(nameText, "");
				text_layer_set_text(despawnTimeLayer, "Request Timed Out!");
				text_layer_set_text(distanceText, "Can't contact servers");
				text_layer_set_text(catchChanceText, "Try again later");
				hasRecievedResponse = true;
				isGoodResponse = false;
			}



		} else {

		}
	} else if(key < 10) {
		char* value = t->value->cstring;

		//APP_LOG(APP_LOG_LEVEL_INFO, "Got key %d with value %s", key, value);

		if(key == MESSAGE_KEY) {
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message!!!: %s", value);
			static char buf[] = "kkdksksdkskdjskdjksdksdksjdksjdsjdjjskdjksdkskdjskdj00000000000";
			snprintf(buf, sizeof(buf), "%s", value);
			text_layer_set_text(nameText, buf);

			text_layer_set_text(directionText, "Uh Oh");
			text_layer_set_text(despawnTimeLayer, "");
			text_layer_set_text(distanceText, "");
			text_layer_set_text(catchChanceText, "");

		}

		if(key == TYPEONE_KEY) {

			if (compassIsCalibrated) {
				//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message!!: %s", value);
				static char buf[] = "asdasdasdasdsadaasdsdsdssdasdasd00000000000";
				snprintf(buf, sizeof(buf), "%s", value);
				text_layer_set_text(distanceText, buf);

			} else {
				text_layer_set_text(nameText, "Tilt watch to calibrate compass!");
			}

		}

		if(key == TYPETWO_KEY) {
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message!: %s", value);
			static char buf[] = "00000000000";
			snprintf(buf, sizeof(buf), "%s", value);
			//text_layer_set_text(typeTwoLayer, buf);
		}
		if(key == CAPRATE_KEY) {
			if (compassIsCalibrated) {
				//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Messages: %s", value);
				static char buf[] = "asdasdasdasdasdasdasdasdasdasdasdasdasd00000000000";
				snprintf(buf, sizeof(buf), "Capture Rate: %s%%", value);
				text_layer_set_text(catchChanceText, buf);

				hasRecievedResponse = true;
				isGoodResponse = true;
			} else {
				text_layer_set_text(nameText, "Tilt watch to calibrate compass!");
			}
		}
		if(key == FLEERATE_KEY) {
			if (compassIsCalibrated) {
				//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message⁄: %s", value);
				static char buf[] = "asdasdasdasdasdasdasdasdasdasdasdasdasd00000000000";
				snprintf(buf, sizeof(buf), "%s", value);
				text_layer_set_text(despawnTimeLayer, buf);
				hasRecievedResponse = true;
				isGoodResponse = true;
			} else {
				text_layer_set_text(nameText, "Tilt watch to calibrate compass!");
			}
		}
		if(key == NAME_KEY) {
			if (compassIsCalibrated) {
				//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message⁄: %s", value);
				static char buf[] = "00000000000";
				snprintf(buf, sizeof(buf), "%s", value);
				text_layer_set_text(nameText, buf);
				hasRecievedResponse = true;
				isGoodResponse = true;
			} else {
				text_layer_set_text(nameText, "Tilt watch to calibrate compass!");
			}
		}
		if(key == STAMINA_KEY) {
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message⁄: %s", value);
			static char buf[] = "asdasdasdasdasdasdasdasdasdasdasdasdasasdasdasdasdasdasdasdasdasdasdasdasdas00000000000";
			snprintf(buf, sizeof(buf), "Stamina: %s", value);
			//text_layer_set_text(staminaLayer, buf);
		}
		if(key == DEFENSE_KEY) {
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message⁄: %s", value);
			static char buf[] = "asdasdasdasdasdasdasdasdasdasdasdasdas00000000000";
			snprintf(buf, sizeof(buf), "Defense: %s", value);
			//text_layer_set_text(defenseLayer, buf);
		}
		if(key == ATTACK_KEY) {
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message⁄: %s", value);
			static char buf[] = "asdasdasdasdasdasdasdasdasdasdasdasdas00000000000";
			snprintf(buf, sizeof(buf), "Attack: %s", value);
			//text_layer_set_text(attackLayer, buf);
		}

	} else if (key == 10) {
		if (compassIsCalibrated) {
			int value = t->value->int32;

			//APP_LOG(APP_LOG_LEVEL_INFO, "Got key %d with value %d", key, value);

			angle = value;
			//APP_LOG(APP_LOG_LEVEL_DEBUG, "Received Message!!!: %s", value);
			static char buf[] = "asdsdasdadasd00000000000";
			hasRecievedResponse = true;
			isGoodResponse = true;
		} else {
			text_layer_set_text(nameText, "Tilt watch to calibrate compass compass!");
		}
	}
}

// Called when a message is received from js
static void in_received_handler(DictionaryIterator *iter, void *context) {

	Tuple *t = dict_read_first(iter);
	if(t){
		process_tuple(t);
	}
	while(t != NULL){
		t = dict_read_next(iter);
		if(t){
			process_tuple(t);
		}
	}

}

// Called when an incoming message from PebbleKitJS is dropped
static void in_dropped_handler(AppMessageResult reason, void *context) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Failed to recieve message");
}

// Called when PebbleKitJS does not acknowledge receipt of a message
static void out_failed_handler(DictionaryIterator *failed, AppMessageResult reason, void *context) {
	APP_LOG(APP_LOG_LEVEL_DEBUG, "Failed to send message");
}

static void compass_heading_handler(CompassHeadingData heading_data) {
	//APP_LOG(APP_LOG_LEVEL_INFO, "COMPASS");

	int degrees = TRIGANGLE_TO_DEG(TRIG_MAX_ANGLE - heading_data.magnetic_heading);

	// Is the compass calibrated?
	switch(heading_data.compass_status) {
		case CompassStatusDataInvalid:
		compassIsCalibrated = false;
		text_layer_set_text(nameText, "Tilt watch to calibrate compass!");
		APP_LOG(APP_LOG_LEVEL_INFO, "Not yet calibrated.");
		break;
		case CompassStatusCalibrating:
			//APP_LOG(APP_LOG_LEVEL_INFO, "CALIBRATING");
			compassIsCalibrated = true;
			if(firstTimeBeingCalibrated) {
				send_message();
				firstTimeBeingCalibrated = false;
			}
			if(hasRecievedResponse) {
				if(isGoodResponse) {
					int a = angle - degrees;
					if(a > 180) {
						a -= 360;
					}
					if(a < -180) {
						a += 360;
					}
					arrowAngle = heading_data.magnetic_heading;
					if(a > -20 && a < 20) {
						text_layer_set_text(directionText, "Go!");
					} else if(a < 0) {
						text_layer_set_text(directionText, "Left!");
						//APP_LOG(APP_LOG_LEVEL_INFO, "Left! Heading is %d %d", degrees, angle);
					} else {
						text_layer_set_text(directionText, "Right!");
						//APP_LOG(APP_LOG_LEVEL_INFO, "Right! Heading is %d %d", degrees, angle);
					}
				}
			} else {
				text_layer_set_text(directionText, "Loading");
			}
		break;
		case CompassStatusCalibrated:
			//APP_LOG(APP_LOG_LEVEL_INFO, "CALIBRATED");
			compassIsCalibrated = true;
			if(firstTimeBeingCalibrated) {
				send_message();
				firstTimeBeingCalibrated = false;
			}
			if(hasRecievedResponse) {
				if(isGoodResponse) {
					int a = angle - degrees;
					if(a > 180) {
						a -= 360;
					}
					if(a < -180) {
						a += 360;
					}
					arrowAngle = heading_data.magnetic_heading;
					if(a > -20 && a < 20) {
						text_layer_set_text(directionText, "Go!");
					} else if(a < 0) {
						text_layer_set_text(directionText, "Left!");
						//APP_LOG(APP_LOG_LEVEL_INFO, "Left! Heading is %d %d", degrees, angle);
					} else {
						text_layer_set_text(directionText, "Right!");
						//APP_LOG(APP_LOG_LEVEL_INFO, "Right! Heading is %d %d", degrees, angle);
					}
				}
			} else {
				text_layer_set_text(directionText, "Loading");
			}

		break;
	}
}

static void window_unload(Window *window) {
	text_layer_destroy(backgroundText);
	text_layer_destroy(nameText);
	text_layer_destroy(distanceText);
	text_layer_destroy(catchChanceText);
	text_layer_destroy(directionText);
	text_layer_destroy(despawnTimeLayer);
}

static void init(void) {
	s_window = window_create();
	window_set_click_config_provider(s_window, click_config_provider);
	compass_service_subscribe(compass_heading_handler);
	window_stack_push(s_window, true);
	GRect bounds = layer_get_bounds(window_get_root_layer(s_window));
	window_set_window_handlers(s_window, (WindowHandlers) {
		.unload = window_unload,
	});


	// Register AppMessage handlers
	app_message_register_inbox_received(in_received_handler);
	app_message_register_inbox_dropped(in_dropped_handler);
	app_message_register_outbox_failed(out_failed_handler);

	// Initialize AppMessage inbox and outbox buffers with a suitable size
	const int inbox_size = 128;
	const int outbox_size = 128;
	app_message_open(inbox_size, outbox_size);

	s_res_gothic_28 = fonts_get_system_font(FONT_KEY_GOTHIC_28);
	s_res_gothic_24 = fonts_get_system_font(FONT_KEY_GOTHIC_24);
	s_res_gothic_18 = fonts_get_system_font(FONT_KEY_GOTHIC_18);
	gothicbold = fonts_get_system_font(FONT_KEY_GOTHIC_18_BOLD);
	s_res_gothic_14 = fonts_get_system_font(FONT_KEY_GOTHIC_14);
	s_res_bitham_42_light = fonts_get_system_font(FONT_KEY_BITHAM_42_LIGHT);
	// backgroundText
	backgroundText = text_layer_create(GRect(0, 0, 144, 62));
	text_layer_set_background_color(backgroundText, GColorBlack);
	text_layer_set_text(backgroundText, "");
	layer_add_child(window_get_root_layer(s_window), (Layer *)backgroundText);

	// nameText
	nameText = text_layer_create(GRect(8, 62, 125, 200));
	text_layer_set_text(nameText, "");
	text_layer_set_text_alignment(nameText, GTextAlignmentCenter);
	text_layer_set_background_color(nameText, GColorClear);
	text_layer_set_font(nameText, s_res_gothic_28);
	layer_add_child(window_get_root_layer(s_window), (Layer *)nameText);

	// distanceText
	distanceText = text_layer_create(GRect(0, 125, 144, 20));
	text_layer_set_text(distanceText, "");
	text_layer_set_background_color(distanceText, GColorClear);
	text_layer_set_text_alignment(distanceText, GTextAlignmentCenter);
	text_layer_set_font(distanceText, s_res_gothic_18);
	layer_add_child(window_get_root_layer(s_window), (Layer *)distanceText);

	// catchChanceText
	catchChanceText = text_layer_create(GRect(0, 144, 144, 20));
	text_layer_set_text(catchChanceText, "");
	text_layer_set_background_color(catchChanceText, GColorClear);
	text_layer_set_text_alignment(catchChanceText, GTextAlignmentCenter);
	text_layer_set_font(catchChanceText, s_res_gothic_14);
	layer_add_child(window_get_root_layer(s_window), (Layer *)catchChanceText);

	s_font = fonts_load_custom_font(resource_get_handle(RESOURCE_ID_CODE_34));
	// directionText
	directionText = text_layer_create(GRect(0, 6, bounds.size.w, 50));
	text_layer_set_background_color(directionText, GColorBlack);
	text_layer_set_text_color(directionText, GColorWhite);
	text_layer_set_text(directionText, "Loading");
	text_layer_set_text_alignment(directionText, GTextAlignmentCenter);
	text_layer_set_font(directionText, s_font);
	layer_add_child(window_get_root_layer(s_window), (Layer *)directionText);

	// despawnTimeLayer
	despawnTimeLayer = text_layer_create(GRect(0, 90, 144, 40));
	text_layer_set_text(despawnTimeLayer, "");
	text_layer_set_background_color(despawnTimeLayer, GColorClear);
	text_layer_set_text_alignment(despawnTimeLayer, GTextAlignmentCenter);
	text_layer_set_background_color(despawnTimeLayer, GColorClear);
	text_layer_set_font(despawnTimeLayer, gothicbold);
	layer_add_child(window_get_root_layer(s_window), (Layer *)despawnTimeLayer);

	//light_enable(true);

}

static void deinit(void) {
	app_message_deregister_callbacks();
	compass_service_unsubscribe();
	window_destroy(s_window);
}

int main( void ) {
	init();
	app_event_loop();
	deinit();
}
