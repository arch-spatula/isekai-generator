class_name Room
extends TileMapLayer
## The fixed combat room. `#` is a wall tile with collision; `P` and `1`–`3` mark spawn points.

const TILE := 16
const FLOOR := Vector2i(0, 0)
const WALL := Vector2i(1, 0)
const LAYOUT: Array[String] = [
	"####################",
	"#..................#",
	"#..1...........3...#",
	"#.......##.........#",
	"#.......##.........#",
	"#..P...........2...#",
	"#..................#",
	"#......##....##....#",
	"#..................#",
	"#..................#",
	"####################",
]


func build(palette: Dictionary) -> void:
	tile_set = _make_tile_set(Color(palette.floor), Color(palette.wall))
	for y in LAYOUT.size():
		var row := LAYOUT[y]
		for x in row.length():
			set_cell(Vector2i(x, y), 0, WALL if row[x] == "#" else FLOOR)


func spawn_point(marker: String) -> Vector2:
	for y in LAYOUT.size():
		var x := LAYOUT[y].find(marker)
		if x >= 0:
			return map_to_local(Vector2i(x, y))
	assert(false, "room layout has no marker " + marker)
	return Vector2.ZERO


func is_wall(world_position: Vector2) -> bool:
	return get_cell_atlas_coords(local_to_map(to_local(world_position))) == WALL


func _make_tile_set(floor_color: Color, wall_color: Color) -> TileSet:
	var image := Image.create(TILE * 2, TILE, false, Image.FORMAT_RGBA8)
	image.fill_rect(Rect2i(Vector2i.ZERO, Vector2i(TILE, TILE)), floor_color)
	image.fill_rect(Rect2i(Vector2i(TILE, 0), Vector2i(TILE, TILE)), wall_color)
	var source := TileSetAtlasSource.new()
	source.texture = ImageTexture.create_from_image(image)
	source.texture_region_size = Vector2i(TILE, TILE)
	source.create_tile(FLOOR)
	source.create_tile(WALL)
	var tiles := TileSet.new()
	tiles.tile_size = Vector2i(TILE, TILE)
	tiles.add_physics_layer()
	tiles.add_source(source, 0)
	var half := TILE / 2.0
	var wall := source.get_tile_data(WALL, 0)
	wall.add_collision_polygon(0)
	wall.set_collision_polygon_points(0, 0, PackedVector2Array([
		Vector2(-half, -half), Vector2(half, -half), Vector2(half, half), Vector2(-half, half),
	]))
	return tiles
