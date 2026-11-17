class_name Projectile
extends Node2D
## A straight shot. Hits the first target within reach and stops at walls.

const LIFETIME := 2.0

var _main: CombatRoom
var _from_player: bool
var _velocity: Vector2
var _damage: int
var _radius: float
var _life: float = LIFETIME


func setup(main: CombatRoom, from_player: bool, velocity: Vector2, damage: int, radius: float) -> void:
	_main = main
	_from_player = from_player
	_velocity = velocity
	_damage = damage
	_radius = radius


func _physics_process(delta: float) -> void:
	position += _velocity * delta
	_life -= delta
	if _life <= 0.0 or _main.room.is_wall(global_position):
		queue_free()
		return
	if _from_player:
		for enemy in _main.enemies:
			if enemy.is_alive() and enemy.global_position.distance_to(global_position) <= _radius + Enemy.RADIUS:
				enemy.take_hit(_damage, global_position)
				queue_free()
				return
	elif _main.player.global_position.distance_to(global_position) <= _radius + Player.RADIUS:
		_main.player.take_hit(_damage)
		queue_free()
