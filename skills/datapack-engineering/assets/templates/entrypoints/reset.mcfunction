#> <namespace>:reset
# Pre-distribution factory reset entrypoint (Mandatory for map packs; NEVER call from gameplay logic)
#
# @context @root
# @public

## 1. Execute Complete Teardown
function <namespace>:uninstall

## 2. Re-bootstrap System Objectives & Constants
function <namespace>:load

## 3. Seed Initial Map State & Permanent Entities
# Summon permanent NPCs, interaction bridges, and display entities
# function <namespace>:system/setup/spawn_npcs
gamemode adventure @a
spawnpoint @a 0 0 0

tellraw @a {"text":"[<namespace>] Reset to pristine initial playable state.","color":"green"}
