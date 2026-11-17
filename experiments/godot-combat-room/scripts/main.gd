class_name CombatRoom
extends Node2D
## Builds the combat room from data/slots.json. Scenes and scripts stay fixed; only the data changes.

var slots: Dictionary
var room: Room
var player: Player
var enemies: Array[Enemy] = []
var effects: Node2D


func _ready() -> void:
	InputSetup.register()
	slots = Slots.load_slots()
	room = Room.new()
	room.build(slots.palette)
	add_child(room)
	player = Player.new()
	player.setup(self, slots)
	player.position = room.spawn_point("P")
	add_child(player)
	for i in slots.enemies.size():
		var enemy := Enemy.new()
		enemy.setup(self, slots.enemies[i], slots.palette)
		enemy.position = room.spawn_point(str(i + 1))
		add_child(enemy)
		enemies.append(enemy)
	effects = Node2D.new()
	add_child(effects)
	var ui := CanvasLayer.new()
	add_child(ui)
	var hud := Hud.new()
	hud.setup(self, slots)
	ui.add_child(hud)
	var pause := PauseMenu.new()
	pause.setup(Color(slots.palette.ui))
	ui.add_child(pause)


func alive_enemy_count() -> int:
	return enemies.filter(func(enemy: Enemy) -> bool: return enemy.is_alive()).size()


func spawn_projectile(from_player: bool, at: Vector2, velocity: Vector2, damage: int, radius: float, effect: String) -> void:
	var shot := Projectile.new()
	shot.setup(self, from_player, velocity, damage, radius)
	shot.position = at
	effects.add_child(shot)
	EffectPlayer.spawn(shot, effect, Vector2.ZERO, velocity.normalized())


## Freezes the game for `duration` seconds of real time when a landed hit's effect reaches its hit frame.
func hit_stop(duration: float) -> void:
	if duration <= 0.0:
		return
	Engine.time_scale = 0.0
	await get_tree().create_timer(duration, true, false, true).timeout
	Engine.time_scale = 1.0
