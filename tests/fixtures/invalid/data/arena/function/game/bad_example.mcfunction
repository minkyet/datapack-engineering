# 잘못된 컨벤션 모음
#
# @public
# @context @root

## 1. 잘못된 번호 매김과 규칙 위반
	scoreboard players set #badCamel arena.temp 1
scoreboard players set #apple arena.const 10
scoreboard players set @s arena.gold 0
execute as @e[nbt={CustomName:'"Bob"'}] run playsound minecraft:entity.experience_orb.pickup master @a
tellraw @a '{"text":"legacy"}'
