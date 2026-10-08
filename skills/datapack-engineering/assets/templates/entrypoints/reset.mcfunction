#> <namespace>:reset
# Pre-distribution factory reset entrypoint (manual admin command before release; NEVER call from any code)
#
# @context @root
# @public
# @writes score #stop_requested_all <namespace>
# @writes score #state <namespace>

## Stop Active Schedulers & Loops
scoreboard players set #stop_requested_all <namespace> 1

## Clear Match & Temporary Entities
kill @e[type=interaction, tag=<namespace>.temp]
kill @e[type=marker, tag=<namespace>.temp]

## Reset Runtime Scores to Initial State
scoreboard players reset * <namespace>.temp
scoreboard players set #state <namespace> 0

## Re-run Load to Prepare Factory State
function <namespace>:load

say [<namespace>] Reset to pristine initial playable state.
