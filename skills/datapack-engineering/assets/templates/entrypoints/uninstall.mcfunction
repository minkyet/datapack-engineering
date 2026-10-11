#> <namespace>:uninstall
# Complete uninstallation & resource teardown entrypoint (Mandatory for ALL packs)
#
# @context @root
# @public

## Cancel Active Schedulers & Loops
schedule clear <namespace>:tick
schedule clear <namespace>:system/...

## Remove All Spawned System & Domain Entities
kill @e[tag=<namespace>]

## Remove Bossbars & Storage Tables
# bossbar remove <namespace>:main
# data remove storage <namespace>:config
# data remove storage <namespace>:runtime

## Remove All Custom Scoreboard Objectives
scoreboard objectives remove <namespace>
scoreboard objectives remove <namespace>.const
scoreboard objectives remove <namespace>.temp

say [<namespace>] Teardown complete. All objectives, entities, and storages removed.
