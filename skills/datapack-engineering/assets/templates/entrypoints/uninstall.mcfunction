#> <namespace>:uninstall
# Complete uninstallation & resource teardown entrypoint (standalone/library packs only)
# [WARNING: Strictly forbidden in map-dependent datapacks - do not implement]
#
# @context @root
# @public

## Stop Active Schedulers & Loops
scoreboard players set #stop_requested_all <namespace> 1

## Remove All Spawned System Entities
kill @e[tag=<namespace>]

## Remove Bossbars & Storage Tables
# bossbar remove <namespace>:main
# data remove storage <namespace>:data

## Remove All Custom Scoreboard Objectives
scoreboard objectives remove <namespace>
scoreboard objectives remove <namespace>.const
scoreboard objectives remove <namespace>.temp
