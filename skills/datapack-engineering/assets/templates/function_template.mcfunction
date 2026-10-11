#> <namespace>:path/to/function
# Brief explanation of function (one-line summary)
#
# @context @root (or player, entity, etc. MUST be player for user/ layer)
# @internal (or @public for user/ APIs, @private within <parent> for zzz/)
# @reads score #example <namespace>
# @writes score #example <namespace>
# @returns

## Subtitle Section
# Contextual explanation (used minimally for essential logic only)
execute if score #state <namespace> matches 1 run \
    tellraw @a {"text":"Ready","color":"green"}
