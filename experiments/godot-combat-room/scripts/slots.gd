class_name Slots
extends RefCounted
## Reads the template's slot data. Validation belongs to the fill tool; this only loads.

const PATH := "res://data/slots.json"


static func load_slots() -> Dictionary:
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(PATH))
	assert(parsed is Dictionary, "data/slots.json must hold a JSON object")
	return parsed
