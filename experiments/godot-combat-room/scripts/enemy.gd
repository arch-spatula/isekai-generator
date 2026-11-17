class_name Enemy
extends CharacterBody2D
## One regular enemy. Every type telegraphs with an outline before it acts.
## charger: dashes at the player. shielder: blocks hits from the front and bashes up close.
## ranged: keeps its distance and throws a shot.

const RADIUS := 6.0
const DAMAGE := 1
const CHARGE_RANGE := 72.0
const CHARGE_SPEED_SCALE := 3.5
const CHARGE_TIME := 0.35
const BASH_RANGE := 22.0
const KEEP_DISTANCE := 96.0
const SHOT_SPEED := 110.0
const SHOT_RADIUS := 4.0
const SHOT_EFFECT := "projectiles/energy-disc"
const RECOVER_TIME := 0.6
const SHIELD_FRONT := 0.5

enum State { CHASE, TELEGRAPH, ACT, RECOVER, DEAD }

var type: String
var health: int
var state: State = State.CHASE
var facing: Vector2 = Vector2.LEFT

var _main: CombatRoom
var _speed: float
var _telegraph: float
var _timer: float = 0.0
var _charge_direction: Vector2 = Vector2.ZERO
var _color: Color
var _telegraph_color: Color


func setup(main: CombatRoom, data: Dictionary, palette: Dictionary) -> void:
	_main = main
	type = data.type
	health = int(data.health)
	_speed = data.moveSpeed
	_telegraph = data.telegraph
	_color = Color(palette.enemy)
	_telegraph_color = Color(palette.telegraph)
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2.ONE * RADIUS * 2.0
	shape.shape = rect
	add_child(shape)
	collision_layer = 4
	collision_mask = 1


func is_alive() -> bool:
	return state != State.DEAD


## Returns whether the hit landed. A shielder blocks hits coming from in front of it.
func take_hit(amount: int, from: Vector2) -> bool:
	if not is_alive():
		return false
	if type == "shielder" and facing.dot((from - global_position).normalized()) > SHIELD_FRONT:
		return false
	health -= amount
	if health <= 0:
		state = State.DEAD
		hide()
		collision_layer = 0
	return true


func _physics_process(delta: float) -> void:
	if not is_alive():
		return
	var player := _main.player
	var to_player := player.global_position - global_position
	var distance := to_player.length()
	var direction := to_player / distance if distance > 0.0 else Vector2.ZERO
	match state:
		State.CHASE:
			facing = direction
			velocity = _chase_velocity(direction, distance)
			if _in_attack_range(distance):
				_charge_direction = direction
				_enter(State.TELEGRAPH, _telegraph)
		State.TELEGRAPH:
			velocity = Vector2.ZERO
			if type == "shielder":
				facing = direction
		State.ACT:
			velocity = Vector2.ZERO
			if type == "charger":
				velocity = _charge_direction * _speed * CHARGE_SPEED_SCALE
				if distance <= RADIUS + Player.RADIUS:
					player.take_hit(DAMAGE)
		State.RECOVER:
			velocity = Vector2.ZERO
	move_and_slide()
	_timer -= delta
	if state != State.CHASE and _timer <= 0.0:
		_advance(direction, distance)
	queue_redraw()


func _chase_velocity(direction: Vector2, distance: float) -> Vector2:
	if type != "ranged":
		return direction * _speed
	if distance < KEEP_DISTANCE * 0.8:
		return -direction * _speed
	if distance > KEEP_DISTANCE:
		return direction * _speed
	return Vector2.ZERO


func _in_attack_range(distance: float) -> bool:
	match type:
		"charger":
			return distance <= CHARGE_RANGE
		"shielder":
			return distance <= BASH_RANGE
	return distance <= KEEP_DISTANCE * 1.2


func _advance(direction: Vector2, distance: float) -> void:
	match state:
		State.TELEGRAPH:
			_enter(State.ACT, CHARGE_TIME if type == "charger" else 0.0)
			if type == "shielder" and distance <= BASH_RANGE + Player.RADIUS:
				_main.player.take_hit(DAMAGE)
			elif type == "ranged":
				_main.spawn_projectile(false, global_position, direction * SHOT_SPEED, DAMAGE, SHOT_RADIUS, SHOT_EFFECT)
		State.ACT:
			_enter(State.RECOVER, RECOVER_TIME)
		State.RECOVER:
			_enter(State.CHASE, 0.0)


func _enter(next: State, duration: float) -> void:
	state = next
	_timer = duration


func _draw() -> void:
	var size := Vector2.ONE * RADIUS * 2.0
	draw_rect(Rect2(-size / 2.0, size), _color)
	if state == State.TELEGRAPH:
		draw_rect(Rect2(-size / 2.0 - Vector2.ONE * 2.0, size + Vector2.ONE * 4.0), _telegraph_color, false, 1.0)
	if type == "shielder":
		var front := facing * (RADIUS + 2.0)
		draw_line(front + facing.orthogonal() * RADIUS, front - facing.orthogonal() * RADIUS, _telegraph_color, 2.0)
