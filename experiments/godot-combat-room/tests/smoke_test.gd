extends SceneTree
## Headless smoke test: builds the room from data/slots.json and checks it against the data.
## Run after `godot --headless --path . --import`:
##   godot --headless --path . -s res://tests/smoke_test.gd
## Exits 0 when every check passes and 1 otherwise.

var _failures: PackedStringArray = []


func _initialize() -> void:
	var slots := Slots.load_slots()
	var scene: PackedScene = load("res://scenes/main.tscn")
	var main := scene.instantiate() as CombatRoom
	root.add_child(main)
	await process_frame
	_check(main.enemies.size() == slots.enemies.size(), "enemy count matches slots")
	for i in main.enemies.size():
		_check(main.enemies[i].type == slots.enemies[i].type, "enemy %d type matches slots" % i)
	_check(main.player.forms.size() == slots.forms.size(), "form count matches slots")
	_check(main.player.can_switch() == (slots.forms.size() == 2), "switching is available only with two forms")
	for form: Dictionary in slots.forms:
		_check(EffectPlayer.has_effect(form.effect), "effect %s exists" % form.effect)
	await _check_attack_lands(main)
	if main.player.can_switch():
		await _check_switching(main)
	for message in _failures:
		printerr("FAIL: " + message)
	print("smoke: %d failure(s)" % _failures.size())
	quit(1 if _failures.size() > 0 else 0)


func _check_attack_lands(main: CombatRoom) -> void:
	for enemy in main.enemies:
		enemy.set_physics_process(false)
	var target: Enemy = null
	for enemy in main.enemies:
		if enemy.type != "shielder":
			target = enemy
			break
	var player := main.player
	var form := player.current_form()
	player.facing = Vector2.RIGHT
	target.global_position = player.global_position + Vector2.RIGHT * float(form.range) * 0.5
	var before := target.health
	player.start_attack()
	await create_timer(float(form.windup) + 0.1).timeout
	_check(target.health < before, "first form attack damages an enemy in reach")


func _check_switching(main: CombatRoom) -> void:
	var player := main.player
	await create_timer(1.0).timeout
	_check(player.state == Player.State.FREE, "player is free after the attack")
	player.start_switch(Vector2.ZERO)
	_check(player.form_index == 1, "a switch changes the form")
	await create_timer(float(main.slots.formSwitch.duration) + 0.05).timeout
	player.start_switch(Vector2.ZERO)
	_check(player.state == Player.State.FOCUS_BREAK, "an early second switch breaks focus")


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
