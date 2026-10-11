#> <namespace>:user/category/action
# Brief description of user interaction
#
# @context player
# @public
# @reads score @s <namespace>.cd_action
# @writes score @s <namespace>.trigger.action

## Consume Input & Reset Triggers (Optional)
# Always clear trigger scores first to prevent infinite loop errors on early exit
scoreboard players reset @s <namespace>.trigger.action
# advancement revoke @s only <namespace>:trigger/action

## Actor Qualification & Early Exit (Optional)
# Verify caller distance, cooldown, permission tags, and alive/stun states
execute at @e[type=marker, tag=<namespace>.target, limit=1] unless entity @s[distance=..5] run \
    return run function <namespace>:visual/msg/too_far
execute if score @s <namespace>.cd_action matches 1.. run \
    return run function <namespace>:visual/fail/invalid

## Delegate to Domain Logic (or View for UI)
# Forward validated request to game/ (or directly to visual/ for pure UI/info)
function <namespace>:game/category/do_action
