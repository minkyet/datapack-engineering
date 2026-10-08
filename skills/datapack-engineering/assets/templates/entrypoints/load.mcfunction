#> <namespace>:load
# Datapack load and initialization entrypoint (#minecraft:load)
#
# @context @root
# @internal
# @handles function_tag minecraft:load

## Register Objectives
scoreboard objectives add <namespace> dummy
scoreboard objectives add <namespace>.const dummy
scoreboard objectives add <namespace>.temp dummy

## Initialize Constants
scoreboard players set ##-1 <namespace>.const -1
scoreboard players set ##0 <namespace>.const 0
scoreboard players set ##1 <namespace>.const 1
scoreboard players set ##20 <namespace>.const 20
