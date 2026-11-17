class_name Player
extends CharacterBody2D
## The player: four-way facing, combo attacks per form, dodge, and switching between two forms.
## Switching again within `formSwitch.earlyWindow` breaks focus: no attack or dodge for
## `formSwitch.focusBreakDelay`. A clean switch steps `formSwitch.sideStep` px to the side.

signal health_changed(current: int, maximum: int)
signal form_changed(index: int)
signal died

const RADIUS := 5.0
const HIT_EFFECT := "impacts/hit-spark"
const HURT_INVULNERABLE := 0.5

enum State { FREE, WINDUP, ACTIVE, RECOVERY, DODGE, SWITCH, FOCUS_BREAK, DEAD }

var forms: Array = []
var form_index: int = 0
var facing: Vector2 = Vector2.RIGHT
var health: int
var max_health: int
var state: State = State.FREE

var _main: CombatRoom
var _move_speed: float
var _dodge: Dictionary
var _switch: Dictionary
var _color: Color
var _timer: float = 0.0
var _combo_step: int = 0
var _queued_attack: bool = false
var _invulnerable: float = 0.0
var _since_switch: float = INF
var _step_velocity: Vector2 = Vector2.ZERO


func setup(main: CombatRoom, slots: Dictionary) -> void:
	_main = main
	var stats: Dictionary = slots.player
	_move_speed = stats.moveSpeed
	max_health = int(stats.maxHealth)
	health = max_health
	_dodge = stats.dodge
	forms = slots.forms
	_switch = slots.get("formSwitch", {})
	_color = Color(slots.palette.player)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2.ONE * RADIUS * 2.0
	shape.shape = rect
	add_child(shape)
	collision_layer = 2
	collision_mask = 1


func current_form() -> Dictionary:
	return forms[form_index]


func can_switch() -> bool:
	return forms.size() == 2


func start_attack() -> void:
	_combo_step = 0
	_begin_hit()


func start_dodge(input: Vector2) -> void:
	var direction := input.normalized() if input != Vector2.ZERO else facing
	var duration := float(_dodge.duration)
	_step_velocity = direction * float(_dodge.distance) / duration
	_invulnerable = float(_dodge.invulnerable)
	_enter(State.DODGE, duration)


func start_switch(input: Vector2) -> void:
	if not can_switch():
		return
	var early := _since_switch < float(_switch.earlyWindow)
	_since_switch = 0.0
	form_index = 1 - form_index
	form_changed.emit(form_index)
	if early:
		_enter(State.FOCUS_BREAK, float(_switch.focusBreakDelay))
		return
	var side := facing.orthogonal()
	if input != Vector2.ZERO and input.dot(side) < 0.0:
		side = -side
	var duration := float(_switch.duration)
	_step_velocity = side * float(_switch.get("sideStep", 0.0)) / duration
	_enter(State.SWITCH, duration)


func take_hit(amount: int) -> void:
	if state == State.DEAD or _invulnerable > 0.0:
		return
	health = maxi(health - amount, 0)
	_invulnerable = HURT_INVULNERABLE
	health_changed.emit(health, max_health)
	if health == 0:
		state = State.DEAD
		died.emit()


func _physics_process(delta: float) -> void:
	_invulnerable = maxf(_invulnerable - delta, 0.0)
	_since_switch += delta
	if state == State.DEAD:
		return
	var input := Input.get_vector("move_left", "move_right", "move_up", "move_down")
	match state:
		State.FREE:
			_update_facing(input)
			velocity = input * _move_speed
			if Input.is_action_just_pressed("attack"):
				start_attack()
			elif Input.is_action_just_pressed("dodge"):
				start_dodge(input)
			elif Input.is_action_just_pressed("switch_form"):
				start_switch(input)
		State.DODGE, State.SWITCH:
			velocity = _step_velocity
		_:
			velocity = Vector2.ZERO
			if Input.is_action_just_pressed("attack"):
				_queued_attack = true
	move_and_slide()
	_advance(delta)
	queue_redraw()


func _advance(delta: float) -> void:
	if state == State.FREE:
		return
	_timer -= delta
	if _timer > 0.0:
		return
	match state:
		State.WINDUP:
			_resolve_attack()
			_enter(State.ACTIVE, float(current_form().active))
		State.ACTIVE:
			_enter(State.RECOVERY, float(current_form().recovery))
		State.RECOVERY:
			if _queued_attack and _combo_step < int(current_form().combo):
				_begin_hit()
			else:
				_combo_step = 0
				_enter(State.FREE, 0.0)
		State.DODGE, State.SWITCH, State.FOCUS_BREAK:
			_enter(State.FREE, 0.0)


func _begin_hit() -> void:
	_queued_attack = false
	_combo_step += 1
	_enter(State.WINDUP, float(current_form().windup))


func _enter(next: State, duration: float) -> void:
	state = next
	_timer = duration


func _resolve_attack() -> void:
	var form := current_form()
	if form.shape == "projectile":
		_main.spawn_projectile(true, global_position, facing * float(form.speed), int(form.damage), float(form.width) / 2.0, form.effect)
		return
	var landed := 0
	for enemy in _main.enemies:
		if enemy.is_alive() and _in_reach(form, enemy.global_position - global_position):
			if enemy.take_hit(int(form.damage), global_position):
				landed += 1
				EffectPlayer.spawn(_main.effects, HIT_EFFECT, enemy.global_position, facing)
	var fx := EffectPlayer.spawn(_main.effects, form.effect, global_position, facing)
	if landed > 0:
		fx.hit_reached.connect(_main.hit_stop, CONNECT_ONE_SHOT)


func _in_reach(form: Dictionary, offset: Vector2) -> bool:
	var reach := float(form.range) + Enemy.RADIUS
	match form.shape:
		"thrust":
			var along := offset.dot(facing)
			var side := absf(offset.dot(facing.orthogonal()))
			return along >= 0.0 and along <= reach and side <= float(form.width) / 2.0 + Enemy.RADIUS
		"arc":
			return offset.length() <= reach and absf(rad_to_deg(facing.angle_to(offset))) <= float(form.arcDegrees) / 2.0
		"area":
			return (offset - facing * float(form.range)).length() <= float(form.radius) + Enemy.RADIUS
	return false


func _update_facing(input: Vector2) -> void:
	if input == Vector2.ZERO:
		return
	if absf(input.x) >= absf(input.y):
		facing = Vector2(signf(input.x), 0.0)
	else:
		facing = Vector2(0.0, signf(input.y))


func _draw() -> void:
	var body := _color
	if state == State.FOCUS_BREAK:
		body = body.darkened(0.5)
	elif _invulnerable > 0.0:
		body.a = 0.5
	draw_rect(Rect2(-Vector2.ONE * RADIUS, Vector2.ONE * RADIUS * 2.0), body)
	draw_line(Vector2.ZERO, facing * (RADIUS + 4.0), body, 2.0)
