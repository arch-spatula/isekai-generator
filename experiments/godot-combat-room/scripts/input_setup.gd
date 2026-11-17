class_name InputSetup
extends RefCounted
## Registers the template's input actions at startup, so project.godot carries no serialized events.

const KEYS := {
	"move_up": [KEY_W, KEY_UP],
	"move_down": [KEY_S, KEY_DOWN],
	"move_left": [KEY_A, KEY_LEFT],
	"move_right": [KEY_D, KEY_RIGHT],
	"attack": [KEY_J, KEY_Z],
	"dodge": [KEY_K, KEY_X],
	"switch_form": [KEY_L, KEY_C],
	"pause": [KEY_ESCAPE],
}

const PAD_BUTTONS := {
	"move_up": JOY_BUTTON_DPAD_UP,
	"move_down": JOY_BUTTON_DPAD_DOWN,
	"move_left": JOY_BUTTON_DPAD_LEFT,
	"move_right": JOY_BUTTON_DPAD_RIGHT,
	"attack": JOY_BUTTON_X,
	"dodge": JOY_BUTTON_A,
	"switch_form": JOY_BUTTON_Y,
	"pause": JOY_BUTTON_START,
}

const PAD_AXES := {
	"move_up": [JOY_AXIS_LEFT_Y, -1.0],
	"move_down": [JOY_AXIS_LEFT_Y, 1.0],
	"move_left": [JOY_AXIS_LEFT_X, -1.0],
	"move_right": [JOY_AXIS_LEFT_X, 1.0],
}


static func register() -> void:
	for action: String in KEYS:
		if InputMap.has_action(action):
			InputMap.action_erase_events(action)
		else:
			InputMap.add_action(action)
		for keycode: int in KEYS[action]:
			var key := InputEventKey.new()
			key.physical_keycode = keycode as Key
			InputMap.action_add_event(action, key)
		var button := InputEventJoypadButton.new()
		button.button_index = PAD_BUTTONS[action] as JoyButton
		InputMap.action_add_event(action, button)
		if PAD_AXES.has(action):
			var motion := InputEventJoypadMotion.new()
			motion.axis = PAD_AXES[action][0] as JoyAxis
			motion.axis_value = PAD_AXES[action][1]
			InputMap.action_add_event(action, motion)


## Replaces every keyboard binding of `action` with `key`, keeping gamepad bindings.
static func rebind(action: String, key: InputEventKey) -> void:
	for event: InputEvent in InputMap.action_get_events(action):
		if event is InputEventKey:
			InputMap.action_erase_event(action, event)
	InputMap.action_add_event(action, key)
