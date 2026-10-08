#> <namespace>:tick
# Datapack main tick dispatcher entrypoint (#minecraft:tick)
#
# @context @root
# @internal
# @handles function_tag minecraft:tick
# @reads score #state <namespace>

## Tick Dispatcher
execute if score #state <namespace> matches 1 run function <namespace>:game/tick
