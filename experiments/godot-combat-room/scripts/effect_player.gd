class_name EffectPlayer
extends AnimatedSprite2D
## Plays one PixelFX sprite sheet: spawns it, loops it or frees it when done, and reports hit times.
## Sheets are drawn side-on facing right; facing up or down rotates them, facing left mirrors them.

## Emitted when playback reaches a hit in the sheet's `act.hits`, with that hit's freeze time.
signal hit_reached(freeze: float)

const ROOT := "res://assets/effects/"

static var _cache: Dictionary = {}

var _hits: Array = []
var _elapsed: float = 0.0
var _next_hit: int = 0


static func has_effect(id: String) -> bool:
	return FileAccess.file_exists(ROOT + id + ".json") and ResourceLoader.exists(ROOT + id + ".png")


static func spawn(parent: Node, id: String, at: Vector2, facing: Vector2) -> EffectPlayer:
	var data := _load(id)
	var fx := EffectPlayer.new()
	fx.sprite_frames = data.frames
	fx.offset = data.offset
	fx._hits = data.hits
	fx.position = at
	if facing.x < 0.0:
		fx.scale.x = -1.0
	else:
		fx.rotation = facing.angle()
	parent.add_child(fx)
	fx.play("default")
	if not data.loop:
		fx.animation_finished.connect(fx.queue_free)
	return fx


static func _load(id: String) -> Dictionary:
	if _cache.has(id):
		return _cache[id]
	var sheet: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ROOT + id + ".json"))
	var texture: Texture2D = load(ROOT + id + ".png")
	var info: Dictionary = sheet.meta.pixelfx
	var frames := SpriteFrames.new()
	frames.set_animation_speed("default", info.fps)
	frames.set_animation_loop("default", info.loop)
	for entry: Dictionary in sheet.frames:
		var rect: Dictionary = entry.frame
		var atlas := AtlasTexture.new()
		atlas.atlas = texture
		atlas.region = Rect2(rect.x, rect.y, rect.w, rect.h)
		frames.add_frame("default", atlas)
	var hits: Array = []
	if info.has("act"):
		for hit: Dictionary in info.act.hits:
			hits.append(hit)
	var size: Array = info.frameSize
	var pivot: Array = info.pivot
	var data := {
		"frames": frames,
		"offset": Vector2(size[0] / 2.0 - pivot[0], size[1] / 2.0 - pivot[1]),
		"hits": hits,
		"loop": info.loop,
	}
	_cache[id] = data
	return data


func _process(delta: float) -> void:
	_elapsed += delta
	while _next_hit < _hits.size() and _elapsed >= float(_hits[_next_hit].t):
		hit_reached.emit(float(_hits[_next_hit].get("freeze", 0.0)))
		_next_hit += 1
