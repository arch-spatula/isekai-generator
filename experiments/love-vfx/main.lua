---@class VfxEffect
---@field kind "slash"|"shockwave"
---@field x number
---@field y number
---@field age number
---@field duration number

---@type number
local sceneWidth = 320
---@type number
local sceneHeight = 180
---@type love.Canvas
local canvas
---@type love.ParticleSystem
local sparks
---@type VfxEffect[]
local effects = {}

---@return number scale
---@return number offsetX
---@return number offsetY
local function viewport()
    ---@type number
    local width, height = love.graphics.getDimensions()
    ---@type number
    local scale = math.max(1, math.floor(math.min(width / sceneWidth, height / sceneHeight)))
    return scale, math.floor((width - sceneWidth * scale) / 2), math.floor((height - sceneHeight * scale) / 2)
end

---@param kind "slash"|"shockwave"|"sparks"|"combined"
---@param x number
---@param y number
---@return nil
local function burst(kind, x, y)
    if kind == "slash" or kind == "combined" then
        effects[#effects + 1] = { kind = "slash", x = x, y = y, age = 0, duration = 0.22 }
    end
    if kind == "shockwave" or kind == "combined" then
        effects[#effects + 1] = { kind = "shockwave", x = x, y = y, age = 0, duration = 0.5 }
    end
    while #effects > 64 do
        table.remove(effects, 1)
    end
    if kind == "sparks" or kind == "combined" then
        sparks:setPosition(x, y)
        sparks:emit(36)
    end
end

---@return nil
function love.load()
    love.window.setMode(960, 540, { resizable = true, minwidth = sceneWidth, minheight = sceneHeight })
    love.window.setTitle("Lua VFX / native LOVE particles")
    love.graphics.setDefaultFilter("nearest", "nearest")
    canvas = love.graphics.newCanvas(sceneWidth, sceneHeight)
    canvas:setFilter("nearest", "nearest")
    ---@type love.ImageData
    local pixel = love.image.newImageData(1, 1)
    pixel:setPixel(0, 0, 1, 1, 1, 1)
    ---@type love.Image
    local texture = love.graphics.newImage(pixel)
    sparks = love.graphics.newParticleSystem(texture, 512)
    sparks:setParticleLifetime(0.15, 0.55)
    sparks:setEmissionRate(0)
    sparks:setDirection(-math.pi / 2)
    sparks:setSpread(math.pi * 2)
    sparks:setSpeed(35, 120)
    sparks:setLinearAcceleration(0, 75, 0, 110)
    sparks:setLinearDamping(2, 4)
    sparks:setSizes(2, 1, 0)
    sparks:setColors(1, 1, 0.8, 1, 1, 0.6, 0.12, 1, 1, 0.18, 0.04, 0)
end

---@param dt number
---@return nil
function love.update(dt)
    sparks:update(dt)
    ---@type integer
    for index = #effects, 1, -1 do
        ---@type VfxEffect
        local effect = effects[index]
        effect.age = effect.age + dt
        if effect.age >= effect.duration then
            table.remove(effects, index)
        end
    end
end

---@param effect VfxEffect
---@return nil
local function drawEffect(effect)
    ---@type number
    local progress = effect.age / effect.duration
    ---@type number
    local fade = 1 - progress
    if effect.kind == "shockwave" then
        love.graphics.setColor(0.25, 0.85, 1, fade)
        love.graphics.setLineWidth(2)
        love.graphics.ellipse("line", effect.x, effect.y + 6, 7 + progress * 48, 3 + progress * 23, 32)
        love.graphics.setColor(0.7, 1, 1, fade * 0.6)
        love.graphics.setLineWidth(1)
        love.graphics.ellipse("line", effect.x, effect.y + 6, 4 + progress * 38, 2 + progress * 18, 32)
    else
        ---@type number
        local angle = -2.5 + progress * 2
        ---@type number
        local radius = 25 + progress * 12
        love.graphics.push()
        love.graphics.translate(effect.x, effect.y)
        love.graphics.scale(1, 0.7)
        love.graphics.setLineWidth(5 * fade + 1)
        love.graphics.setColor(0.4, 0.65, 1, fade * 0.7)
        love.graphics.arc("line", "open", 0, 0, radius, angle, angle + 1.8, 18)
        love.graphics.setLineWidth(2)
        love.graphics.setColor(1, 1, 1, fade)
        love.graphics.arc("line", "open", 0, 0, radius + 2, angle + 0.15, angle + 1.8, 18)
        love.graphics.pop()
    end
end

---@return nil
function love.draw()
    love.graphics.setCanvas(canvas)
    love.graphics.clear(0.07, 0.09, 0.13, 1)
    love.graphics.setLineWidth(1)
    love.graphics.setColor(0.12, 0.15, 0.19, 1)
    ---@type integer
    for x = 0, sceneWidth, 16 do
        love.graphics.line(x, 0, x, sceneHeight)
    end
    ---@type integer
    for y = 0, sceneHeight, 16 do
        love.graphics.line(0, y, sceneWidth, y)
    end
    love.graphics.setColor(0.03, 0.04, 0.06, 1)
    love.graphics.ellipse("fill", 160, 98, 12, 5)
    love.graphics.setColor(0.42, 0.29, 0.24, 1)
    love.graphics.rectangle("fill", 154, 80, 12, 17)
    love.graphics.setColor(0.85, 0.65, 0.4, 1)
    love.graphics.rectangle("fill", 156, 74, 8, 8)
    love.graphics.rectangle("fill", 149, 83, 22, 4)
    ---@type integer
    for index = 1, #effects do
        drawEffect(effects[index])
    end
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(sparks)
    love.graphics.print("1 Slash  2 Wave  3 Sparks", 7, 6)
    love.graphics.print("Space / Click: combo   R: clear", 7, 160)
    love.graphics.setCanvas()
    love.graphics.clear(0.025, 0.03, 0.04, 1)
    ---@type number
    local scale, offsetX, offsetY = viewport()
    love.graphics.setColor(1, 1, 1, 1)
    love.graphics.draw(canvas, offsetX, offsetY, 0, scale, scale)
end

---@param key love.KeyConstant
---@return nil
function love.keypressed(key)
    if key == "1" then
        burst("slash", 160, 90)
    elseif key == "2" then
        burst("shockwave", 160, 90)
    elseif key == "3" then
        burst("sparks", 160, 90)
    elseif key == "space" then
        burst("combined", 160, 90)
    elseif key == "r" then
        effects = {}
        sparks:reset()
    elseif key == "escape" then
        love.event.quit()
    end
end

---@param x number
---@param y number
---@param button integer
---@return nil
function love.mousepressed(x, y, button)
    if button ~= 1 then
        return
    end
    ---@type number
    local scale, offsetX, offsetY = viewport()
    ---@type number
    local sceneX = (x - offsetX) / scale
    ---@type number
    local sceneY = (y - offsetY) / scale
    if sceneX >= 0 and sceneX < sceneWidth and sceneY >= 0 and sceneY < sceneHeight then
        burst("combined", sceneX, sceneY)
    end
end
