class_name PauseMenu
extends Control
## Pause toggle and the minimal rebinding path: while paused, press R, then the new attack key.

const FONT_SIZE := 8

var _color: Color
var _waiting_for_key: bool = false


func setup(color: Color) -> void:
	_color = color
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	hide()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("pause") and not _waiting_for_key:
		get_tree().paused = not get_tree().paused
		visible = get_tree().paused
		get_viewport().set_input_as_handled()
		return
	var key := event as InputEventKey
	if not get_tree().paused or key == null or not key.pressed or key.echo:
		return
	if _waiting_for_key:
		var bound := InputEventKey.new()
		bound.physical_keycode = key.physical_keycode
		InputSetup.rebind("attack", bound)
		_waiting_for_key = false
	elif key.physical_keycode == KEY_R:
		_waiting_for_key = true
	queue_redraw()
	get_viewport().set_input_as_handled()


func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.0, 0.0, 0.0, 0.6))
	var text := "press the new ATTACK key" if _waiting_for_key else "PAUSED   R: rebind attack"
	draw_string(get_theme_default_font(), Vector2(8, size.y / 2.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, _color)
