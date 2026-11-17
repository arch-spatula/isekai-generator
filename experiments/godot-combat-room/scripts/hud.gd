class_name Hud
extends Control
## Health pips, the current form and the number of enemies left.

const FONT_SIZE := 8

var _main: CombatRoom
var _color: Color
var _form_labels: Dictionary


func setup(main: CombatRoom, slots: Dictionary) -> void:
	_main = main
	_color = Color(slots.palette.ui)
	_form_labels = slots.labels.forms
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _process(_delta: float) -> void:
	queue_redraw()


func _draw() -> void:
	var player := _main.player
	for i in player.max_health:
		draw_rect(Rect2(4 + i * 7, 4, 5, 5), _color, i < player.health)
	var form := player.current_form()
	var text := "%s  enemies %d" % [_form_labels.get(form.id, form.id), _main.alive_enemy_count()]
	if player.state == Player.State.FOCUS_BREAK:
		text += "  focus broken"
	draw_string(get_theme_default_font(), Vector2(4, 20), text, HORIZONTAL_ALIGNMENT_LEFT, -1, FONT_SIZE, _color)
