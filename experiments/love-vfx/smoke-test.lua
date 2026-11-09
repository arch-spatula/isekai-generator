-- Run from the repository root: lua experiments/love-vfx/smoke-test.lua
-- Callback smoke test only: mocks cannot validate pixels or real LÖVE compatibility.

---@type integer
local geometry = 0
---@type integer
local emitted = 0
---@type number
local updated = 0
---@type integer
local resets = 0
---@type boolean
local quit = false
---@type number[]
local position = {}
---@type number[]
local presentation = {}
---@type number[]
local canvasSize = {}
---@type boolean
local nearest = false
---@type integer
local particleDraws = 0

---@return nil
local function noop() end

---@return nil
local function primitive()
    geometry = geometry + 1
end

---@type table<string, any>
local particles = {
    setParticleLifetime = noop, setEmissionRate = noop, setSizes = noop,
    setSpeed = noop, setLinearAcceleration = noop, setSpread = noop,
    setColors = noop, setDirection = noop, setDamping = noop,
    setLinearDamping = noop, setRotation = noop, setSpin = noop,
    setAreaSpread = noop, setSizeVariation = noop, stop = noop,
}
---@param self table
---@param count integer
---@return nil
function particles:emit(count)
    assert(count > 0, "particle burst must emit particles")
    emitted = emitted + count
end
---@param self table
---@param dt number
---@return nil
function particles:update(dt) updated = updated + dt end
---@param self table
---@return nil
function particles:reset() resets = resets + 1 end
---@param self table
---@param x number
---@param y number
---@return nil
function particles:setPosition(x, y) position = { x, y } end
---@param self table
---@return integer
function particles:getCount() return 0 end

---@type table<string, any>
local canvas = { setFilter = noop }
---@type table<string, any>
local image = { setFilter = noop }
---@type table<string, any>
local graphics = {
    setCanvas = noop, clear = noop, setColor = noop, setLineWidth = noop,
    setBlendMode = noop, push = noop, pop = noop, translate = noop,
    rotate = noop, scale = noop, origin = noop, setFont = noop,
    print = noop, printf = noop, rectangle = primitive, circle = primitive,
    ellipse = primitive, polygon = primitive, line = primitive, arc = primitive,
    points = primitive,
}
---@param min string
---@param mag string
---@return nil
function graphics.setDefaultFilter(min, mag) nearest = min == "nearest" and mag == "nearest" end
---@return number, number
function graphics.getDimensions() return 1000, 700 end
---@return number
function graphics.getWidth() return 1000 end
---@return number
function graphics.getHeight() return 700 end
---@param width number
---@param height number
---@return table
function graphics.newCanvas(width, height)
    canvasSize = { width, height }
    return canvas
end
---@return table
function graphics.newImage() return image end
---@return table
function graphics.newParticleSystem() return particles end
---@param drawable table
---@param x? number
---@param y? number
---@param rotation? number
---@param sx? number
---@param sy? number
---@return nil
function graphics.draw(drawable, x, y, rotation, sx, sy)
    if drawable == canvas then presentation = { x or 0, y or 0, sx or 1, sy or sx or 1 } end
    if drawable == particles then particleDraws = particleDraws + 1 end
end

---@diagnostic disable-next-line: assign-type-mismatch
love = {
    graphics = graphics,
    window = { setMode = noop, setTitle = noop },
    image = { newImageData = function() return { setPixel = noop, mapPixel = noop } end },
    math = { random = math.random, randomNormal = function() return 0 end },
    event = { quit = function() quit = true end },
    timer = { getFPS = function() return 60 end, getTime = function() return 0 end },
}

dofile("experiments/love-vfx/main.lua")
---@type string[]
local callbacks = { "load", "update", "draw", "keypressed", "mousepressed" }
for _, name in ipairs(callbacks) do assert(type(love[name]) == "function", "missing callback: " .. name) end
love.load()

---@return integer
local function drawCount()
    geometry = 0
    love.draw()
    return geometry
end

---@return nil
local function expire()
    for _ = 1, 600 do love.update(1 / 60) end
end

love.keypressed("r")
---@type integer
local idle = drawCount()
assert(nearest, "scene must use nearest filtering")
assert(#canvasSize == 2 and canvasSize[1] < 1000 and canvasSize[2] < 700, "scene needs a low-resolution canvas")
assert(presentation[3] >= 1 and presentation[3] % 1 == 0 and presentation[3] == presentation[4], "canvas scale must be uniform and integer")

---@type table<string, integer>
local proceduralDraws = {}
for _, key in ipairs({ "1", "2", "space" }) do
    love.keypressed("r")
    love.keypressed(key)
    proceduralDraws[key] = drawCount() - idle
    assert(proceduralDraws[key] > 0, key .. " must draw a procedural effect")
    if key == "space" then
        assert(proceduralDraws[key] == proceduralDraws["1"] + proceduralDraws["2"], "space must draw both independently observed procedural effects")
    end
    expire()
    assert(drawCount() == idle, key .. " procedural effect must expire")
end

---@type integer
local beforeEmit = emitted
love.keypressed("3")
assert(emitted > beforeEmit, "3 must emit native particles")
---@type integer
local beforeParticleDraw = particleDraws
drawCount()
assert(particleDraws > beforeParticleDraw, "native particle system must be drawn")
---@type number
local beforeUpdate = updated
love.update(1 / 60)
assert(updated > beforeUpdate, "native particles must update")
beforeEmit = emitted
love.keypressed("space")
assert(emitted > beforeEmit, "space must include native particles")

love.keypressed("r")
drawCount()
---@type number
local sceneX = canvasSize[1] * 0.3
---@type number
local sceneY = canvasSize[2] * 0.6
beforeEmit = emitted
love.mousepressed(presentation[1] + sceneX * presentation[3], presentation[2] + sceneY * presentation[4], 1)
assert(emitted > beforeEmit, "left click must emit native particles")
assert(drawCount() - idle == proceduralDraws["1"] + proceduralDraws["2"], "left click must draw both independently observed procedural effects")
assert(math.abs(position[1] - sceneX) < 0.001 and math.abs(position[2] - sceneY) < 0.001, "click must map through canvas scale and letterboxing")
---@type integer
local beforeReset = resets
love.keypressed("r")
assert(resets > beforeReset and drawCount() == idle, "r must reset particles and clear procedural effects")
love.keypressed("escape")
assert(quit, "escape must quit")
print("love-vfx callback smoke test passed (mock graphics; visual review still required)")
